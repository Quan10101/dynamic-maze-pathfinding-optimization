"""Deterministic shortest-path algorithms. No third-party packages."""
from collections import deque
from heapq import heappush, heappop
from dataclasses import dataclass
from time import perf_counter_ns

@dataclass
class Solution:
    algorithm: str
    path: list[int]
    expanded: int
    runtime_ms: float
    valid: bool
    reason: str
    trace: list[dict]


def neighbors(u, n, blocked):
    r,c=divmod(u,n)
    for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)):
        rr,cc=r+dr,c+dc
        if 0<=rr<n and 0<=cc<n:
            v=rr*n+cc
            if v not in blocked:
                yield v


def validate(path,n,blocked,start,end):
    if not path:
        return False,'no-path (requires oracle to confirm infeasibility)'
    if path[0]!=start or path[-1]!=end:
        return False,'wrong endpoints'
    for u,v in zip(path,path[1:]):
        if u<0 or u>=n*n or v<0 or v>=n*n or u in blocked or v in blocked:
            return False,'out-of-bounds or wall'
        a,b=divmod(u,n); c,d=divmod(v,n)
        if abs(a-c)+abs(b-d)!=1:
            return False,'not adjacent'
    return True,'all constraints satisfied'


def reconstruct(par,end):
    if end not in par:return []
    out=[]; u=end
    while u is not None:
        out.append(u);u=par[u]
    return out[::-1]


def search(algorithm,n,blocked,start=0,end=None,trace_limit=120):
    if end is None:end=n*n-1
    blocked=set(blocked)
    if not 2<=n<=200 or not 0<=start<n*n or not 0<=end<n*n or start in blocked or end in blocked:
        raise ValueError('Invalid map/start/end')
    t0=perf_counter_ns(); expanded=0; trace=[]
    def mark(u,frontier,side="forward"):
        nonlocal expanded
        expanded+=1
        if len(trace)<trace_limit:trace.append({'iteration':expanded,'node':u,'frontier':frontier,'side':side})
    if algorithm=='bfs':
        q=deque([start]);par={start:None}
        while q:
            u=q.popleft();mark(u,len(q))
            if u==end:break
            for v in neighbors(u,n,blocked):
                if v not in par:par[v]=u;q.append(v)
        path=reconstruct(par,end)
    elif algorithm in ('dijkstra','astar'):
        er,ec=divmod(end,n)
        def h(u):
            r,c=divmod(u,n);return abs(r-er)+abs(c-ec)
        pq=[(h(start) if algorithm=='astar' else 0,0,start)];par={start:None};dist={start:0};closed=set();ticket=0
        while pq:
            _,g,u=heappop(pq)
            if u in closed or g!=dist[u]:continue
            closed.add(u);mark(u,len(pq))
            if u==end:break
            for v in neighbors(u,n,blocked):
                ng=g+1
                if ng<dist.get(v,float('inf')):
                    dist[v]=ng;par[v]=u;ticket+=1
                    heappush(pq,(ng+(h(v) if algorithm=='astar' else 0),ng,v))
        path=reconstruct(par,end)
    elif algorithm=='bibfs':
        # Improved BFS: expand the smaller frontier; finish a full layer on each expansion.
        # Determine shortest distance by minimizing distS[u]+distE[u] at intersections.
        qs=deque([start]);qt=deque([end]);ps={start:None};pt={end:None};ds={start:0};dt={end:0}
        best=float('inf');meet=None
        while qs and qt:
            if min(ds[u] for u in qs)+min(dt[u] for u in qt)>=best:break
            forward=len(qs)<=len(qt)
            q,other,own_d,other_d,own_p=(qs,dt,ds,dt,ps) if forward else (qt,ds,dt,ds,pt)
            layer=len(q)
            for _ in range(layer):
                u=q.popleft();mark(u,len(qs)+len(qt),"forward" if forward else "reverse")
                if u in other and own_d[u]+other[u]<best:
                    best=own_d[u]+other[u];meet=u
                for v in neighbors(u,n,blocked):
                    if v not in own_d:
                        own_d[v]=own_d[u]+1;own_p[v]=u;q.append(v)
                    if v in other and own_d[v]+other[v]<best:
                        best=own_d[v]+other[v];meet=v
        if meet is None:path=[]
        else:
            left=reconstruct(ps,meet)
            right=[];u=pt[meet]
            while u is not None:right.append(u);u=pt[u]
            path=left+right
    else:raise ValueError('Unknown algorithm')
    runtime_ms=(perf_counter_ns()-t0)/1e6
    valid,reason=validate(path,n,blocked,start,end)
    return Solution(algorithm,path,expanded,runtime_ms,valid,reason,trace)


def verify_with_oracle(solution,n,blocked,start,end):
    """Use BFS as independent oracle for length and (in)feasibility."""
    oracle=search('bfs',n,blocked,start,end,trace_limit=0)
    correct=bool(solution.path)==bool(oracle.path) and len(solution.path)==len(oracle.path)
    valid=validate(solution.path,n,blocked,start,end)[0] if solution.path else not oracle.path
    return {'passed':correct and valid,'optimal_length':len(oracle.path)-1 if oracle.path else None,'feasible':bool(oracle.path),'constraints_ok':valid}
