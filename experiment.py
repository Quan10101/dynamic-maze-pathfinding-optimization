"""Reproducible static/dynamic experiments with persisted run-level records."""
from optimizer import search,verify_with_oracle
from pathlib import Path
from datetime import datetime
from statistics import mean,pstdev
from collections import defaultdict
import csv,json,random,platform,sys,argparse,time

ROOT=Path(__file__).resolve().parent/'results'
ALGORITHMS=['bfs','bibfs','dijkstra','astar']
def maze(n,density,seed):
    rng=random.Random(seed)
    return {i for i in range(1,n*n-1) if rng.random()<density}

def dynamic_run(algorithm,n,walls,seed,max_events=4):
    """Paired dynamic event schedule: same cells and travel-step times for all algorithms.
    An event is injected at each milestone regardless of chosen route. Replan only
    when the current route becomes invalid. All events are generated before routing.
    """
    rng=random.Random(seed); initial=set(walls); blocked=set(walls)
    candidates=[i for i in range(1,n*n-1) if i not in initial]
    rng.shuffle(candidates)
    milestones=[2,5,9,14][:max_events]
    schedule=list(zip(milestones,candidates[:len(milestones)]))
    agent=0;end=n*n-1;travel=0;replans=0;expanded=0;ms=0.;events=[]
    route=[];index=0;attempts=0
    def plan():
        nonlocal route,index,replans,expanded,ms,attempts
        result=search(algorithm,n,blocked,agent,end,0)
        replans+=1;attempts+=1;expanded+=result.expanded;ms+=result.runtime_ms
        route=result.path;index=0
        return bool(route)
    if not plan():
        return {'completed':False,'steps_travelled':travel,'replans':replans,'expanded_total':expanded,'runtime_total_ms':ms,'events':events}
    for _ in range(2*n*n):
        if agent==end:break
        while schedule and travel>=schedule[0][0]:
            at,node=schedule.pop(0)
            if node==agent:events.append({'at_step':at,'blocked_node':node,'skipped':'agent'});continue
            blocked.add(node);events.append({'at_step':at,'blocked_node':node})
        if not route or any(node in blocked for node in route[index+1:]):
            if not plan():break
        if index+1>=len(route):break
        nxt=route[index+1]
        if nxt in blocked:raise AssertionError('Dynamic route crosses wall')
        agent=nxt;index+=1;travel+=1
    return {'completed':agent==end,'steps_travelled':travel,'replans':replans,'expanded_total':expanded,'runtime_total_ms':ms,'events':events}

def svg_chart(title,rows,key,unit,path):
    labels=[r['algorithm'].upper() for r in rows]; values=[float(r[key]) for r in rows]
    top=max(values+[1])*1.13; w=760;h=360; plot_left=85;plot_right=720;plot_top=65;plot_bottom=292
    import html
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
        '<rect width="760" height="360" fill="#ffffff"/>',
        f'<text x="28" y="36" font-size="21" font-family="Arial" font-weight="bold" fill="#172c51">{html.escape(title)}</text>',
        f'<line x1="{plot_left}" x2="{plot_right}" y1="{plot_bottom}" y2="{plot_bottom}" stroke="#8898b1"/>']
    colors=['#3657aa','#1c9e86','#bc6f25','#8056ab']
    for k,(name,value) in enumerate(zip(labels,values)):
        x=120+k*150; height=(value/top)*(plot_bottom-plot_top)
        parts += [f'<rect x="{x}" y="{plot_bottom-height:.1f}" width="78" height="{height:.1f}" rx="5" fill="{colors[k]}"/>',
            f'<text x="{x+39}" y="{plot_bottom-height-9:.1f}" font-size="14" text-anchor="middle" font-family="Arial" fill="#172c51">{value:.3f}</text>',
            f'<text x="{x+39}" y="{plot_bottom+24}" font-size="14" text-anchor="middle" font-family="Arial" fill="#172c51">{name}</text>']
    parts.append(f'<text x="{plot_left}" y="341" font-size="13" font-family="Arial" fill="#58657c">{html.escape(unit)} · Kết quả chạy Python thực tế</text></svg>')
    path.write_text(''.join(parts),encoding='utf-8')

def run_experiment(trials=120,sizes=(15,20,30),densities=(0.10,0.25,0.35),seed=20261016,outdir=None,progress=None,visual_delay=0):
    if not 1<=trials<=1000:raise ValueError('trials must be 1..1000')
    path=Path(outdir) if outdir else ROOT/datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    path.mkdir(parents=True,exist_ok=True)
    records=[];trace=[]; dynamic_records=[]; mismatches=0
    for i in range(trials):
        n=sizes[i%len(sizes)];density=densities[(i//len(sizes))%len(densities)]
        maze_seed=seed+1009*i; blocked=maze(n,density,maze_seed)
        baseline=search('bfs',n,blocked,0,n*n-1,trace_limit=2*n*n)
        for a in ALGORITHMS:
            solution=baseline if a=='bfs' else search(a,n,blocked,0,n*n-1,trace_limit=2*n*n)
            check=verify_with_oracle(solution,n,blocked,0,n*n-1)
            if not check['passed']:mismatches+=1
            records.append({'scenario':i,'seed':maze_seed,'size':n,'density':density,'algorithm':a,
                            'found':int(bool(solution.path)),'path_length':len(solution.path)-1 if solution.path else '',
                            'expanded':solution.expanded,'runtime_ms':round(solution.runtime_ms,6),
                            'valid':int(check['passed']),'oracle_length':check['optimal_length'] if check['feasible'] else ''})
            # Keep detailed trace for 1st scenario, as complete logs per scenario would be large.
            if progress:
                progress({'scenario':i+1,'total':trials,'algorithm':a,'completed':i*len(ALGORITHMS)+ALGORITHMS.index(a)+1,
                          'total_runs':trials*len(ALGORITHMS),'size':n,'density':density,
                          'walls':sorted(blocked),'trace':solution.trace,'path':solution.path,
                          'expanded':solution.expanded,'runtime_ms':round(solution.runtime_ms,6),
                          'valid':check['passed'],'found':bool(solution.path),
                          'path_length':len(solution.path)-1 if solution.path else None,
                          'record':records[-1]})
                if visual_delay:time.sleep(visual_delay)
            if i==0:trace.extend([{'algorithm':a,**t} for t in solution.trace])
            if i<min(trials,40):
                result=dynamic_run(a,n,blocked,maze_seed+999,4)
                dynamic_records.append({'scenario':i,'seed':maze_seed,'size':n,'density':density,'algorithm':a,
                    **{k:v for k,v in result.items() if k!='events'},'events_json':json.dumps(result['events'])})
    def write_csv(file,rows):
        with (path/file).open('w',newline='',encoding='utf-8-sig') as f:
            wr=csv.DictWriter(f,fieldnames=list(rows[0]));wr.writeheader();wr.writerows(rows)
    write_csv('runs.csv',records);write_csv('dynamic_runs.csv',dynamic_records)
    (path/'trace_first_scenario.json').write_text(json.dumps(trace,ensure_ascii=False,indent=2),encoding='utf-8')
    summary=[]
    groups=defaultdict(list)
    for row in records:groups[row['algorithm']].append(row)
    for a in ALGORITHMS:
        rs=groups[a]; lengths=[float(r['path_length']) for r in rs if r['found']]
        tm=[r['runtime_ms'] for r in rs];ex=[r['expanded'] for r in rs]
        summary.append({'algorithm':a,'trials':len(rs),'success_rate':round(sum(r['found'] for r in rs)/len(rs),4),
            'valid_rate':round(sum(r['valid'] for r in rs)/len(rs),4),
            'mean_length_success_only':round(mean(lengths),3) if lengths else None,
            'mean_expanded':round(mean(ex),3),'std_expanded':round(pstdev(ex),3),
            'mean_runtime_ms':round(mean(tm),6),'std_runtime_ms':round(pstdev(tm),6),
            'median_runtime_ms':sorted(tm)[len(tm)//2]})
    write_csv('summary.csv',summary)
    (path/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    figures=path/'figures';figures.mkdir(exist_ok=True)
    svg_chart('So o mo rong trung binh',summary,'mean_expanded','Số ô mở rộng',figures/'expanded.svg')
    svg_chart('Thoi gian tinh toan trung binh',summary,'mean_runtime_ms','ms',figures/'runtime.svg')
    dyn_groups=defaultdict(list)
    for row in dynamic_records:dyn_groups[row['algorithm']].append(row)
    dyn_summary=[]
    for a in ALGORITHMS:
        rows=dyn_groups[a]
        if rows:
            dyn_summary.append({'algorithm':a,'trials':len(rows),'success_rate':round(mean(int(r['completed']) for r in rows),4),
            'mean_replans':round(mean(r['replans'] for r in rows),3),
            'mean_travel_steps':round(mean(r['steps_travelled'] for r in rows),3),
            'mean_expanded_total':round(mean(r['expanded_total'] for r in rows),3)})
    if dyn_summary:write_csv('dynamic_summary.csv',dyn_summary)
    metadata={'seed':seed,'trials':trials,'sizes':sizes,'densities':densities,'algorithms':ALGORITHMS,
        'python':sys.version,'platform':platform.platform(),'mismatches':mismatches,
        'design':'paired scenarios; same seed, grid, obstacles, S/E, cost; no tuning on test; warmup not separated',
        'dynamic_design':'paired scenarios, fixed event positions and injection steps across algorithms, same original map and seed; skip event if at current agent position',
        'convergence':'exact discrete shortest path algorithms; trace shows cumulative frontier/expanded, NOT loss-convergence curve'}
    (path/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    # Decision is conditional and based on observed verified metrics.
    candidates=[r for r in summary if r['valid_rate']==1]
    best=min(candidates,key=lambda r:r['mean_expanded']) if candidates else None
    report=['# Kết quả thí nghiệm (được sinh từ số liệu thực tế)','',f'- Số kịch bản tĩnh: {trials}; số bài toán động: {len(dynamic_records)}.',f'- Số nghiệm không khớp oracle BFS: {mismatches}.','', '| Thuật toán | Tỷ lệ nghiệm đúng | Số ô xét TB ± SD | Runtime TB ± SD (ms) |','|---|---:|---:|---:|']
    for r in summary:report.append(f"| {r['algorithm']} | {r['valid_rate']:.1%} | {r['mean_expanded']:.1f} ± {r['std_expanded']:.1f} | {r['mean_runtime_ms']:.4f} ± {r['std_runtime_ms']:.4f} |")
    report.extend(['','## Ra quyết định',f"- Theo số ô xét trung bình trên tập kiểm thử này, **{best['algorithm'] if best else 'chưa có phương pháp đủ điều kiện'}** ít ô xét nhất trong số phương pháp có tỷ lệ nghiệm đúng 100%." if best else '- Chưa thể chọn phương pháp.', '- Nếu yêu cầu nghiệm ngắn nhất trên lưới đơn vị và dễ kiểm chứng: BFS là baseline phù hợp.', '- Nếu cần giảm ô xét: ưu tiên phương pháp có số ô xét tốt nhất, sau khi kiểm tra runtime/độ ổn định trên máy triển khai.', '- Khi tường thay đổi, phải lập lại kế hoạch; không khẳng định tối ưu toàn bộ hành trình khi không biết trước biến cố.','', '## Giới hạn','- Không đo hội tụ loss: đây là thuật toán tìm đường chính xác, không phải tối ưu ngẫu nhiên học lặp.','- So sánh động dùng cùng tọa độ/tốc độ chèn tường theo seed; khi vật cản đúng vị trí agent hiện tại, sự kiện được bỏ qua vì không thể đặt tường lên agent.','- Runtime ngắn dễ nhiễu; cần lặp lại nhiều đợt và warm-up nếu muốn so sánh thời gian nghiêm ngặt.'])
    (path/'ket_luan.md').write_text('\n'.join(report),encoding='utf-8')
    return {'folder':str(path),'summary':summary,'mismatches':mismatches,'dynamic_runs':len(dynamic_records),'dynamic_summary':dyn_summary}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--trials',type=int,default=120);p.add_argument('--seed',type=int,default=20261016);args=p.parse_args()
    result=run_experiment(trials=args.trials,seed=args.seed)
    print(json.dumps(result,ensure_ascii=False,indent=2))
