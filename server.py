"""Local Python API and static dashboard; standard library only."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import os,json,threading,uuid,copy,time,webbrowser
from optimizer import search,verify_with_oracle
from experiment import run_experiment
from live_search import LiveSearch
BASE=Path(__file__).resolve().parent
os.chdir(BASE)
JOBS={}
SEARCHES={}
LOCK=threading.Lock()
def run_job(job_id,trials,seed):
    def report(update):
        with LOCK:
            job=JOBS[job_id]
            job['current']=update
            job['completed']=update['completed']
            # Store just records, not full solver traces for every trial.
            job['records'].append(update['record'])
            delay=job.get('visual_delay_ms',140)
        time.sleep(max(0.005,delay/1000))
    try:
        result=run_experiment(trials=trials,seed=seed,progress=report,visual_delay=0)
        with LOCK:JOBS[job_id].update(done=True,result=result)
    except Exception as exc:
        with LOCK:JOBS[job_id].update(done=True,error=str(exc))

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store');super().end_headers()
    def json_response(self,data,status=200):
        payload=json.dumps(data,ensure_ascii=False,default=str).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path.startswith('/api/experiment/status/'):
            job_id=parsed.path.rsplit('/',1)[-1]
            with LOCK:
                item=JOBS.get(job_id)
                response=copy.deepcopy(item) if item else None
            if response is None:self.json_response({'error':'Unknown experiment'},404)
            else:self.json_response(response)
            return
        super().do_GET()
    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length',0))
            if length>1000000:raise ValueError('Request too large')
            data=json.loads(self.rfile.read(length))
            endpoint=urlparse(self.path).path
            if endpoint=='/api/live/start':
                n=int(data['size']);walls=set(map(int,data['walls']))
                run=LiveSearch(str(data['algorithm']),n,walls,int(data['start']),int(data['end']))
                sid=uuid.uuid4().hex
                with LOCK:SEARCHES[sid]=run
                self.json_response({'session':sid,'done':False,'expanded':0})
            elif endpoint=='/api/live/step':
                sid=str(data['session'])
                with LOCK:
                    if sid not in SEARCHES:raise ValueError('Session not found')
                    result=SEARCHES[sid].step()
                self.json_response(result)
            elif endpoint=='/api/live/edit':
                sid=str(data['session']);node=int(data['node']);add=bool(data['add'])
                with LOCK:
                    if sid not in SEARCHES:raise ValueError('Session not found')
                    run=SEARCHES[sid];restart=run.apply_wall(node,add)
                self.json_response({'restart':restart})
            elif endpoint=='/api/solve':
                n=int(data['size']);blocked=set(map(int,data['walls']))
                start=int(data.get('start',0));end=int(data.get('end',n*n-1))
                sol=search(str(data['algorithm']),n,blocked,start,end,trace_limit=n*n)
                check=verify_with_oracle(sol,n,blocked,start,end)
                self.json_response({'algorithm':sol.algorithm,'path':sol.path,'expanded':sol.expanded,'runtime_ms':sol.runtime_ms,'trace':sol.trace,'verification':check})
            elif endpoint.startswith('/api/experiment/speed/'):
                job_id=endpoint.rsplit('/',1)[-1]
                delay=max(20,min(1500,int(data.get('visual_delay_ms',140))))
                with LOCK:
                    if job_id not in JOBS:raise ValueError('Unknown experiment')
                    JOBS[job_id]['visual_delay_ms']=delay
                self.json_response({'ok':True,'visual_delay_ms':delay})
            elif endpoint=='/api/experiment/start':
                trials=int(data.get('trials',120));seed=int(data.get('seed',20261016))
                if not 1<=trials<=1000:raise ValueError('trials must be 1..1000')
                job_id=uuid.uuid4().hex
                delay=max(20,min(1500,int(data.get('visual_delay_ms',140))))
                with LOCK:JOBS[job_id]={'visual_delay_ms':delay,'done':False,'completed':0,'total_runs':trials*4,'current':None,'records':[],'error':None,'result':None}
                threading.Thread(target=run_job,args=(job_id,trials,seed),daemon=True).start()
                self.json_response({'job_id':job_id})
            elif endpoint=='/api/experiment':
                result=run_experiment(trials=int(data.get('trials',120)),seed=int(data.get('seed',20261016)))
                self.json_response(result)
            else:self.json_response({'error':'Not found'},404)
        except (KeyError,TypeError,ValueError) as e:self.json_response({'error':str(e)},400)
        except Exception as e:self.json_response({'error':repr(e)},500)
if __name__=='__main__':
    url='http://127.0.0.1:8000/'
    try:
        server=ThreadingHTTPServer(('127.0.0.1',8000),Handler)
    except OSError as exc:
        print(f'Khong the khoi dong server tren cong 8000: {exc}',flush=True)
        print('Hay tat server PathLab dang chay truoc khi mo lai.',flush=True)
        raise SystemExit(1)
    print(f'PathLab dang chay tai {url}',flush=True)
    print('Trinh duyet se tu dong mo. Nhan Ctrl+C de dung server.',flush=True)
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Dang dung PathLab...',flush=True)
    finally:
        server.server_close()

