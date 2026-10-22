'use strict';
const $=id=>document.getElementById(id);
const canvas=$('maze'),ctx=canvas.getContext('2d');
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
let n=20,walls=new Set(),start=0,agent=0,end=n*n-1,path=[],explored=[],moving=false,timer=null,tool='wall',drag=false,changes=0,travelled=0,logs=[],benchRecords=[];
let searchTrace=[],traceIndex=0,searchPhase='ready',previewPath=[],plannedFound=false,expandedSides=new Map();
const idx=(r,c,N=n)=>r*N+c;
const rc=(id,N=n)=>[Math.floor(id/N),id%N];
const key=(r,c)=>idx(r,c);
const clock=()=>new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
function log(text){logs.unshift({at:clock(),text});logs=logs.slice(0,180);$('logs').innerHTML=logs.slice(0,30).map(v=>`<div class="log-item"><time>${v.at}</time>${v.text}</div>`).join('');}
function message(text,type='info'){ /* Inline help bar removed; alerts remain in flash(). */ }
let flashTimer=null;
function flash(text,type='info',duration=2400){const el=$('flashBanner'); el.textContent=text; el.hidden=false; el.className='flash-banner show '+type; clearTimeout(flashTimer); if(duration>0){flashTimer=setTimeout(()=>{el.hidden=true; el.className='flash-banner';},duration);}}
function setStatus(text,color=''){const p=$('statusPill');p.textContent='● '+text;p.style.color=color||'#187d53';}
class Heap{constructor(){this.a=[]}push(item){let a=this.a;a.push(item);let i=a.length-1;while(i>0){let p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p}a[i]=item}pop(){const a=this.a,top=a[0],v=a.pop();if(!a.length)return top;let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j}a[i]=v;return top}get length(){return this.a.length}}
// Each search expansion is performed by Python on demand; no precomputed animation.
let liveSession=null, busy=false, generation=0;
async function liveCall(endpoint,data){
 const r=await fetch('/api/live/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const j=await r.json();if(!r.ok)throw Error(j.error||'Python API error');return j;
}
function explanation(){
 const a=$('algorithm').value;
 $('proof').textContent=a==='bfs'?'BFS mở rộng lần lượt các lớp khoảng cách nên lần đầu gặp E cho số bước nhỏ nhất.':a==='bibfs'?'BFS hai chiều tìm từ hai đầu và nối hai nhánh tại giao điểm bảo đảm độ dài đường ngắn nhất.':a==='astar'?'A* dùng Manhattan làm heuristic admissible và consistent trên lưới 4 hướng chi phí đơn vị.':'Dijkstra mở rộng nút có chi phí từ S nhỏ nhất, nên nghiệm tối ưu với trọng số không âm.';
}
function plan(why='Bắt đầu tìm kiếm'){
 generation++;liveSession=null;busy=false;searchPhase='ready';path=[];explored=[];expandedSides.clear();previewPath=[];
 $('expanded').textContent='0';$('pathLength').textContent='—';$('runtime').innerHTML='0.00 <i>ms</i>';
 $('positionLabel').textContent=`(${rc(agent).join(', ')})`;explanation();
 log(why+' · Chưa bắt đầu tìm kiếm');render();
}
async function ensureSession(){
 if(liveSession)return liveSession;
 const token=generation;
 const data=await liveCall('start',{algorithm:$('algorithm').value,size:n,walls:[...walls],start:agent,end});
 if(token!==generation)return null;
 liveSession=data.session;searchPhase='searching';$('pathLength').textContent='Đang tìm…';setStatus('Đang tìm kiếm trực tiếp');return liveSession;
}
async function advanceSearch(){
 if(busy)return;
 busy=true;const token=generation;
 try{
  const session=await ensureSession();if(!session||token!==generation)return;
  const result=await liveCall('step',{session});if(token!==generation)return;
  if(result.node!==null&&result.node!==undefined){explored.push(result.node);expandedSides.set(result.node,result.side||'forward');log('Ô '+result.expanded+': '+rc(result.node).join(', ')+' · '+(result.side==='reverse'?'hướng từ E':'hướng từ S'));}
  $('expanded').textContent=String(result.expanded);
  $('runtime').innerHTML=result.runtime_ms.toFixed(2)+' <i>ms</i>';
  if(result.done){
   path=result.path||[];searchPhase=path.length?'route':'unreachable';
   $('pathLength').textContent=path.length?String(Math.max(0,path.length-1)):'Không có đường';
   if(!path.length){stop();setStatus('Không có đường','#ffa5ad');flash('Không tồn tại đường đi tới E','error',3200);}
   else{setStatus('Đã tìm thấy đường ngắn nhất');log('Tìm xong: '+(path.length-1)+' bước · '+result.expanded+' ô đã xét');}
  }
  render();
 }catch(e){if(token===generation){stop();setStatus('Lỗi máy chủ','#ffa5ad');flash(e.message,'error',3200)}}
 finally{busy=false}
}
function replan(why){changes++;$('replans').textContent=changes;plan(why);if(moving)setStatus('Đang tính lại đường');}
async function step(){
 if(busy)return;
 if(searchPhase==='ready'||searchPhase==='searching'){await advanceSearch();return;}
 if(searchPhase==='unreachable'){stop();return;}
 if(agent===end){$('pathLength').textContent='0';stop();setStatus('Đã đến đích');flash('Đã đến đích thành công','success',3200);return;}
 if(path.length<2){plan('Tìm lại đường');return;}
 const next=path[1];if(walls.has(next)){replan('Đường bị chặn');flash('Đường bị chặn · đang tìm lại','warning',2600);return;}
 agent=next;travelled++;path.shift();$('positionLabel').textContent=`(${rc(agent).join(', ')})`;
 $('pathLength').textContent=String(Math.max(0,path.length-1));render();
 if(agent===end){$('pathLength').textContent='0';stop();setStatus('Đã đến đích');flash('Đã đến đích thành công','success',3200);log('ĐÃ ĐẾN ĐÍCH · '+travelled+' bước');}
}
function stop(){moving=false;clearInterval(timer);timer=null;$('run').textContent='▶  Bắt đầu di chuyển'}
function startMove(){
 if(moving){stop();setStatus('Đã tạm dừng');return;}
 if(agent===end){flash('Đã ở đích','info',2200);return;}
 if(searchPhase==='unreachable')plan('Thử tìm lại');
 moving=true;$('run').textContent='⏸  Tạm dừng';setStatus(searchPhase==='route'?'Đang di chuyển':'Đang xét từng ô');
 timer=setInterval(step,Number($('speed').value));step();
}
function paint(){
 const N=n,cell=canvas.width/N,gap=N>=25?1:1.35;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e4ebf5';ctx.fillRect(0,0,canvas.width,canvas.height);
 const seen=new Set(explored),route=new Set(path),showRoute=searchPhase!=='searching';
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){
  const id=idx(r,c);let color='#f5f8ff';
  if(seen.has(id))color=expandedSides.get(id)==='reverse'?'#81d5e4':'#c7b6fa';
  if(showRoute&&route.has(id))color='#f4bb4e';
  if(walls.has(id))color='#526580';
  if(id===end)color='#149e65';if(id===agent)color='#2869e8';
  ctx.fillStyle=color;ctx.fillRect(c*cell+gap,r*cell+gap,cell-2*gap,cell-2*gap);
 }
 const numbering= N<=25 ? Math.max(7,cell*.28) : Math.max(6,cell*.22);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${numbering}px system-ui`;
 explored.forEach((node,i)=>{
  if(node!==agent&&node!==end&&!walls.has(node)){
   const [r,c]=rc(node);ctx.fillStyle='#422d71';ctx.fillText(String(i+1),(c+.5)*cell,(r+.5)*cell);
  }
 });
 if(showRoute&&path.length>1){
  ctx.font=`bold ${Math.max(10,cell*.5)}px system-ui`;ctx.fillStyle='#422704';
  for(let i=1;i<path.length-1;i++){
   const [r,c]=rc(path[i]),[nr,nc]=rc(path[i+1]);
   const arrow=nr>r?'↓':nr<r?'↑':nc>c?'→':'←';
   ctx.fillText(arrow,(c+.5)*cell,(r+.5)*cell);
  }
 }
 function label(id,text){let [r,c]=rc(id);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.max(10,cell*.45)}px system-ui`;ctx.fillText(text,(c+.5)*cell,(r+.5)*cell)}
 label(agent,'S');if(end!==agent)label(end,'E');
}
function render(){paint()}
function rand(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function generateMap(N,density,seed){const random=rand(seed),M=new Set();for(let i=0;i<N*N;i++){if(i===0||i===N*N-1)continue;if(random()<density)M.add(i)}return M}
function newMap(){stop();n=Number($('size').value);start=agent=0;end=n*n-1;travelled=0;changes=0;walls=generateMap(n,Number($('density').value)/100,(Math.random()*4294967295)>>>0);$('replans').textContent='0';plan('Tạo mê cung mới');setStatus('Sẵn sàng');}
async function editAt(ev){
 const bounds=canvas.getBoundingClientRect();const c=Math.floor((ev.clientX-bounds.left)/bounds.width*n),r=Math.floor((ev.clientY-bounds.top)/bounds.height*n);
 if(r<0||c<0||r>=n||c>=n)return;const id=idx(r,c);
 if(tool==='wall'&&(id===agent||id===end)){if(!dragWarned){flash('Không thể đặt tường lên nhân vật hoặc đích','warning',1800);dragWarned=true;}return;}
 let changed=false,add=false;
 if(tool==='wall'&&!walls.has(id)){walls.add(id);changed=true;add=true;}
 else if(tool==='erase'&&walls.has(id)){walls.delete(id);changed=true;}
 else if(tool==='start'&&!moving&&id!==end&&!walls.has(id)&&agent!==id){start=agent=id;travelled=0;changed=true;}
 else if(tool==='end'&&!moving&&id!==agent&&!walls.has(id)&&end!==id){end=id;changed=true;}
 if(!changed)return;
 if(tool==='start'||tool==='end'){replan('Đổi vị trí đầu/cuối');return;}
 // While walking, only a blocked planned route invalidates its current plan.
 if(searchPhase==='route'){
  if(add&&!path.includes(id)){render();return;}
  replan(add?'Đường bị chặn':'Xóa tường tạo khả năng có đường ngắn hơn');
  if(add)flash('Đường bị chặn · đang tìm lại','warning',2400);
  return;
 }
 // While searching: send edit to the Python state machine.
 // If the wall was never discovered, no restart is needed.
 if(liveSession&&searchPhase==='searching'){
  const token=generation;
  try{
   const result=await liveCall('edit',{session:liveSession,node:id,add});
   if(token!==generation)return;
   if(result.restart){replan('Bản đồ thay đổi ảnh hưởng vùng đã tìm kiếm');}
   else{render();log('Đã cập nhật tường, giữ nguyên tiến trình tìm kiếm');}
  }catch(e){if(token===generation){replan('Cập nhật tường');flash('Đã cập nhật bản đồ','info',1200);}}
 }else {render();}
}
let dragWarned=false;
canvas.addEventListener('pointerdown',e=>{dragWarned=false;drag=true;canvas.setPointerCapture(e.pointerId);editAt(e)});canvas.addEventListener('pointermove',e=>{if(drag&&['wall','erase'].includes(tool))editAt(e)});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('.tool').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
$('run').onclick=startMove;$('step').onclick=()=>{stop();step()};$('generate').onclick=newMap;$('density').oninput=()=>{$('densityValue').textContent=$('density').value+'%'};$('algorithm').onchange=()=>replan('Đổi thuật toán');$('speed').onchange=()=>{if(moving){clearInterval(timer);timer=setInterval(step,Number($('speed').value))}};$('reset').onclick=()=>{stop();agent=start;travelled=0;plan('Đặt lại vị trí');setStatus('Sẵn sàng');message('Đã đặt lại vị trí bắt đầu của nhân vật.','info');flash('Đã đặt lại vị trí', 'info', 1600)};$('clear').onclick=()=>{walls.clear();replan('Đã xóa toàn bộ tường');message('Đã xóa toàn bộ tường trên bản đồ hiện tại.','info');flash('Đã xóa toàn bộ tường', 'info', 1800)};
function csv(rows){return rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')}
function download(content,name){const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
$('exportLog').onclick=()=>download(csv([['Thời gian','Sự kiện'],...logs.map(x=>[x.at,x.text])]),'nhat_ky_dynamic_maze.csv');
$('exportBench').onclick=()=>{if(!benchRecords.length){message('Hãy chạy thực nghiệm trước khi xuất dữ liệu.');return}download(csv([['scenario','seed','size','density','algorithm','success','path_length','expanded','runtime_ms'],...benchRecords.map(x=>[x.scenario,x.seed,x.size,x.density,x.algorithm,x.success,x.path_length,x.expanded,x.runtime_ms])]),'thuc_nghiem_bfs_dijkstra_astar.csv')};
// Progressive Python benchmark with actual per-run solver traces.
let benchAnimation=null,benchLastRun=0,activeBenchJob=null,benchAnimationToken=0;
function drawExperiment(run,seen,showPath){
 const canvas=$('benchCanvas'),ctx=canvas.getContext('2d'),n=run.size,w=canvas.width/n;
 ctx.fillStyle='#e4ebf5';ctx.fillRect(0,0,canvas.width,canvas.height);
 const walls=new Set(run.walls),visited=new Set(run.trace.slice(0,seen).map(x=>x.node)),path=new Set(showPath?run.path:[]);
 for(let i=0;i<n*n;i++){
  ctx.fillStyle=walls.has(i)?'#526580':path.has(i)?'#f4bb4e':visited.has(i)?'#c7b6fa':'#f5f8ff';
  if(i===0)ctx.fillStyle='#2869e8';if(i===n*n-1)ctx.fillStyle='#149e65';
  const r=Math.floor(i/n),c=i%n;
  ctx.fillRect(c*w+0.4,r*w+0.4,Math.max(0,w-.8),Math.max(0,w-.8));
 }
}
function animateExperiment(run){
 // A benchmark speed setting is the delay PER RUN, not the delay per explored cell.
 // Fit the whole trace inside that run's slot so the next Python run cannot erase it early.
 const token=++benchAnimationToken;
 if(benchAnimation!==null){cancelAnimationFrame(benchAnimation);benchAnimation=null;}
 const lim=run.trace.length;
 const duration=Math.max(90, Number($('benchSpeed').value)*0.88);
 let started=null,painted=-1;
 const baseCaption=`Lưới ${run.size}×${run.size}, mật độ tường ${(run.density*100).toFixed(0)}%.`;
 function paint(seen,final){
  if(seen===painted&&!final)return;
  painted=seen;
  drawExperiment(run,seen,final);
  $('benchMapLabel').textContent=baseCaption+` Đã phát ${seen}/${lim} ô được xét.`+
   (final?(run.path&&run.path.length?' Đã hiển thị đường tối ưu.':' Không tìm thấy đường đến E.'):' Đang phát quá trình tìm kiếm…');
 }
 paint(0,false);
 function frame(now){
  if(token!==benchAnimationToken)return;
  if(started===null)started=now;
  const fraction=Math.min(1,(now-started)/duration);
  let shown=Math.min(lim,Math.floor(lim*fraction));
  // Guarantee a visible first discovery as soon as the animation starts.
  if(shown===0&&lim>0&&fraction>0)shown=1;
  paint(shown,false);
  if(fraction<1){benchAnimation=requestAnimationFrame(frame);return;}
  paint(lim,true);
  benchAnimation=null;
 }
 benchAnimation=requestAnimationFrame(frame);
}
function updateLive(run,completed,total){
 $('benchProgressLabel').textContent=`Đã chạy ${completed}/${total} lượt tìm đường · Kịch bản ${run.scenario} · ${run.algorithm.toUpperCase()}`;
 $('benchPercent').textContent=(100*completed/total).toFixed(1)+'%';
 $('benchProgressFill').style.width=(100*completed/total)+'%';
 $('liveScenario').textContent=`${run.scenario} / ${Math.ceil(total/4)}`;
 $('liveAlgorithm').textContent=run.algorithm.toUpperCase();
 $('liveExpanded').textContent=run.expanded;
 $('liveLength').textContent=run.path_length??'Không có đường';
 $('liveVerified').textContent=run.valid?'✓ Nghiệm hợp lệ':'✕ Kiểm tra thất bại';
 $('liveVerified').style.color=run.valid?'#61d7af':'#ff8f8f';
 $('liveRuntime').textContent=run.runtime_ms.toFixed(4)+' ms';
 // The animated caption is owned by animateExperiment and updated frame-by-frame.
 animateExperiment(run);
}
function renderPartial(rows){
 const by={};for(const r of rows)(by[r.algorithm]??=[]).push(r);
 $('resultRows').innerHTML=['bfs','bibfs','dijkstra','astar'].map(a=>{
  const rs=by[a]||[];if(!rs.length)return `<tr><td><b>${a.toUpperCase()}</b></td><td colspan="4">Chờ chạy...</td></tr>`;
  const ok=rs.filter(x=>x.found),avg=key=>(rs.reduce((t,x)=>t+x[key],0)/rs.length);
  return `<tr><td><b>${a.toUpperCase()}</b></td><td>${ok.length}/${rs.length}</td><td>${ok.length?(ok.reduce((t,x)=>t+x.path_length,0)/ok.length).toFixed(2):'—'}</td><td>${avg('expanded').toFixed(2)}</td><td>${avg('runtime_ms').toFixed(4)} ms</td></tr>`
 }).join('');
 const max=Math.max(1,...Object.values(by).map(rs=>rs.reduce((t,x)=>t+x.expanded,0)/rs.length));
 $('bars').innerHTML=Object.entries(by).map(([a,rs])=>{const avg=rs.reduce((t,x)=>t+x.expanded,0)/rs.length;
 return `<div><div class="bar-label"><span>${a.toUpperCase()} (${rs.length} lần)</span><span>${avg.toFixed(1)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${(avg/max*100).toFixed(1)}%"></div></div></div>`
 }).join('');
}
$('benchmark').onclick=async()=>{
 const button=$('benchmark'),count=Number($('trials').value);button.disabled=true;button.textContent='◉ Đang thực nghiệm...';
 $('benchLive').hidden=false;$('benchProgressFill').style.width='0%';
 $('benchInfo').textContent=`Đang chạy ${count*4} lượt tìm đường. Bảng và đồ thị cập nhật từng lượt, mỗi nghiệm được kiểm tra bằng oracle BFS.`;
 window.lastResults=null;benchLastRun=0;
 try{
  const response=await fetch('/api/experiment/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trials:count,seed:20261016,visual_delay_ms:Number($('benchSpeed').value)})});
  const info=await response.json();if(!response.ok)throw Error(info.error);activeBenchJob=info.job_id;
  let finished=false;
  while(!finished){
   await new Promise(resolve=>setTimeout(resolve,160));
   const res=await fetch('/api/experiment/status/'+info.job_id);const job=await res.json();if(!res.ok)throw Error(job.error);
   if(job.current&&job.completed!==benchLastRun){benchLastRun=job.completed;updateLive(job.current,job.completed,job.total_runs);renderPartial(job.records)}
   if(job.done){if(job.error)throw Error(job.error);finished=true;
    const result=job.result,summary=result.summary,max=Math.max(1,...summary.map(x=>x.mean_expanded));
    $('resultRows').innerHTML=summary.map(x=>`<tr><td><b>${x.algorithm.toUpperCase()}</b></td><td>${Math.round(x.success_rate*x.trials)}/${x.trials}</td><td>${x.mean_length_success_only??'—'}</td><td>${x.mean_expanded.toFixed(2)} ± ${x.std_expanded.toFixed(2)}</td><td>${x.mean_runtime_ms.toFixed(4)} ± ${x.std_runtime_ms.toFixed(4)} ms</td></tr>`).join('');
    $('bars').innerHTML=summary.map(x=>`<div><div class="bar-label"><span>${x.algorithm.toUpperCase()}</span><span>${x.mean_expanded.toFixed(1)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${x.mean_expanded/max*100}%"></div></div></div>`).join('');
    const folder='results/'+result.folder.split(/[\\/]/).pop();window.lastResults=folder;
    $('benchProgressLabel').textContent=`Hoàn thành ${count*4} lượt tìm đường`;
    $('benchPercent').textContent='100%';$('benchProgressFill').style.width='100%';
    $('benchInfo').innerHTML=`Đã lưu ${count*4} lượt tĩnh và ${result.dynamic_runs} lượt động. Nghiệm sai: ${result.mismatches}. <a href="${folder}/runs.csv" target="_blank">Lịch sử CSV</a> · <a href="${folder}/dynamic_runs.csv" target="_blank">Lịch sử động</a> · <a href="${folder}/summary.csv" target="_blank">Mean ± Std</a> · <a href="${folder}/trace_first_scenario.json" target="_blank">Lịch sử tìm kiếm</a> · <a href="${folder}/ket_luan.md" target="_blank">Quyết định cuối</a>`;
    v25ShowResults(result,folder);
    log(`Đã hoàn tất ${count*4} lượt thực nghiệm, ${result.mismatches} nghiệm sai`);
   }
  }
 }catch(error){$('benchInfo').textContent='Lỗi thực nghiệm: '+error.message}
 finally{activeBenchJob=null;button.disabled=false;button.textContent='▶ Chạy thực nghiệm'}
};
$('exportBench').onclick=()=>{if(window.lastResults)location.href=window.lastResults+'/runs.csv';else message('Hãy chạy thực nghiệm trước khi xuất CSV.');};
// Initial state
newMap();

// V4 speed buttons: update speed live without restarting the run.
(function(){
  const speed = document.getElementById('speed');
  const adjust = offset => { const next=Math.max(0, Math.min(speed.options.length-1, speed.selectedIndex+offset)); speed.selectedIndex=next; speed.dispatchEvent(new Event('change', {bubbles:true})); };
  document.getElementById('speedDown').addEventListener('click',()=>adjust(-1));
  document.getElementById('speedUp').addEventListener('click',()=>adjust(1));
})();

// V5: independent experiment speed, adjustable during an active experiment.
(function(){
 const speed=$('benchSpeed');
 const changeSpeed=()=>{
  if(activeBenchJob){fetch('/api/experiment/speed/'+activeBenchJob,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visual_delay_ms:Number(speed.value)})}).catch(()=>{});}
 };
 speed.addEventListener('change',changeSpeed);
 const adjust=d=>{speed.selectedIndex=Math.max(0,Math.min(speed.options.length-1,speed.selectedIndex+d));changeSpeed()};
 $('benchSpeedDown').addEventListener('click',()=>adjust(-1));
 $('benchSpeedUp').addEventListener('click',()=>adjust(1));
})();

// V25: charts and dynamic experiment interpretation are based strictly on Python CSV metrics.
function v25Chart(id, summary, key, unit){
 const canvas=$(id);if(!canvas)return;const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
 const max=Math.max(1e-8,...summary.map(r=>Number(r[key])))*1.18;
 const names={bfs:'BFS',bibfs:'BFS hai chiều',astar:'A*',dijkstra:'Dijkstra'};
 const colors=['#355caa','#1e9c85','#ac6d27','#8456b0'];ctx.font='13px Arial';
 ctx.strokeStyle='#cbd5e1';ctx.beginPath();ctx.moveTo(52,18);ctx.lineTo(52,222);ctx.lineTo(620,222);ctx.stroke();
 for(let j=0;j<=4;j++){const y=222-j*50;ctx.fillStyle='#64748b';ctx.textAlign='right';ctx.fillText((max*j/4).toFixed(key==='mean_runtime_ms'?2:0),46,y+5);ctx.strokeStyle='#e4e9f1';ctx.beginPath();ctx.moveTo(52,y);ctx.lineTo(620,y);ctx.stroke();}
 summary.forEach((r,i)=>{const x=88+i*137,v=Number(r[key]),hh=v/max*188;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,222-hh,72,hh);ctx.fillStyle='#142748';ctx.textAlign='center';ctx.fillText(v.toFixed(key==='mean_runtime_ms'?3:1),x+36,213-hh);ctx.fillText(names[r.algorithm]||r.algorithm,x+36,245);});
 ctx.font='12px Arial';ctx.fillStyle='#64748b';ctx.textAlign='left';ctx.fillText('Trung bình thực đo · '+unit,52,265);
}
function v25ShowResults(result,folder){
 const summary=result.summary||[];
 v25Chart('expandedChart',summary,'mean_expanded','số ô');
 v25Chart('runtimeChart',summary,'mean_runtime_ms','ms');
 const eligible=summary.filter(r=>Number(r.valid_rate)===1); const best=[...eligible].sort((a,b)=>a.mean_expanded-b.mean_expanded)[0];
 $('v25Decision').textContent=`Đã kiểm tra ${summary.reduce((x,r)=>x+r.trials,0)} lượt tìm kiếm; ${result.mismatches} nghiệm không khớp BFS oracle. `+(best?`Trên bộ dữ liệu hiện tại, ${best.algorithm.toUpperCase()} mở rộng ít ô nhất (${best.mean_expanded.toFixed(2)} ô trung bình), trong nhóm có 100% nghiệm hợp lệ. Đây không mặc định là thuật toán chạy nhanh nhất.`:'Chưa đủ dữ liệu để đề xuất phương pháp.');
 const dyn=result.dynamic_summary||[];
 $('v25Dynamic').innerHTML=dyn.length?`<table class="v25-table"><thead><tr><th>Thuật toán</th><th>Thành công</th><th>Tìm đường (TB)</th><th>Bước di chuyển (TB)</th><th>Ô xét tổng (TB)</th></tr></thead><tbody>${dyn.map(r=>`<tr><td>${r.algorithm.toUpperCase()}</td><td>${(100*r.success_rate).toFixed(1)}%</td><td>${r.mean_replans}</td><td>${r.mean_travel_steps}</td><td>${r.mean_expanded_total}</td></tr>`).join('')}</tbody></table>`:'Chưa có thực nghiệm động.';
 $('v25Downloads').innerHTML=`<a href="${folder}/figures/expanded.svg" target="_blank">Biểu đồ số ô (SVG)</a> · <a href="${folder}/figures/runtime.svg" target="_blank">Biểu đồ runtime (SVG)</a> · <a href="${folder}/dynamic_summary.csv">Tổng hợp động (CSV)</a> · <a href="${folder}/summary.json">Kết quả (JSON)</a> · <a href="${folder}/metadata.json">Seed & cấu hình (JSON)</a>`;
}
