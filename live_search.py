"""Stateful incremental search: one actual Python expansion per /step request."""
from collections import deque
from heapq import heappush, heappop
from time import perf_counter
from optimizer import neighbors, reconstruct

class LiveSearch:
    def __init__(self, algorithm, n, walls, start, end):
        if algorithm not in ('bfs','bibfs','astar','dijkstra'):raise ValueError('Unknown algorithm')
        if not 2 <= n <= 200 or any(not 0<=x<n*n for x in (start,end)) or start in walls or end in walls:
            raise ValueError('Invalid map')
        self.algorithm,self.n,self.walls,self.start,self.end=algorithm,n,set(walls),start,end
        self.expanded=0;self.elapsed_ms=0;self.done=False;self.path=[];self.closed=set()
        self.discovered={start}
        if algorithm=='bfs':
            self.queue=deque([start]);self.parent={start:None}
        elif algorithm in ('astar','dijkstra'):
            self.parent={start:None};self.dist={start:0};self.heap=[(self.h(start) if algorithm=='astar' else 0,0,start)]
        else:
            self.qs=deque([start]);self.qt=deque([end]);self.ps={start:None};self.pt={end:None}
            self.ds={start:0};self.dt={end:0};self.discovered={start,end}
            self.depth_side=None;self.best=float('inf');self.meet=None
    def h(self,u):
        a,b=divmod(u,self.n);c,d=divmod(self.end,self.n)
        return abs(a-c)+abs(b-d)
    def apply_wall(self, node, add):
        if node in (self.start,self.end):raise ValueError('Cannot block endpoints')
        if add:self.walls.add(node)
        else:self.walls.discard(node)
        # Anything previously discovered may be part of a parent chain, so restart.
        # A wall removal may create a shorter solution, also requiring a restart.
        restart=(not add or node in self.discovered or self.done)
        return restart
    def finish(self):
        self.done=True
        if self.algorithm=='bibfs':
            if self.meet is not None:
                left=reconstruct(self.ps,self.meet);right=[];u=self.pt[self.meet]
                while u is not None:right.append(u);u=self.pt[u]
                self.path=left+right
        else:self.path=reconstruct(self.parent,self.end)
    def step(self):
        if self.done:return {'done':True,'path':self.path,'expanded':self.expanded,'runtime_ms':self.elapsed_ms}
        start=perf_counter()
        node=None;side='forward';cost=None
        if self.algorithm=='bfs':
            while self.queue and self.queue[0] in self.walls:self.queue.popleft()
            if not self.queue:self.finish()
            else:
                node=self.queue.popleft();self.closed.add(node)
                if node==self.end:self.finish()
                else:
                    for v in neighbors(node,self.n,self.walls):
                        if v not in self.discovered:self.discovered.add(v);self.parent[v]=node;self.queue.append(v)
        elif self.algorithm in ('astar','dijkstra'):
            while self.heap:
                _,g,u=heappop(self.heap)
                if u in self.walls or u in self.closed or self.dist.get(u)!=g:continue
                node=u;self.closed.add(u);cost=g
                if u==self.end:self.finish()
                else:
                    for v in neighbors(u,self.n,self.walls):
                        ng=g+1
                        if ng<self.dist.get(v,float('inf')):
                            self.dist[v]=ng;self.discovered.add(v);self.parent[v]=u
                            heappush(self.heap,(ng+(self.h(v) if self.algorithm=='astar' else 0),ng,v))
                break
            if node is None:self.finish()
        else:
            if not self.qs or not self.qt or self.ds[self.qs[0]]+self.dt[self.qt[0]]>=self.best:
                self.finish()
            else:
                # Complete the selected depth layer before switching directions.
                if self.depth_side is None:
                    self.depth_side='forward' if len(self.qs)<=len(self.qt) else 'reverse'
                    self.layer_depth=(self.ds[self.qs[0]] if self.depth_side=='forward' else self.dt[self.qt[0]])
                side=self.depth_side
                q,dist,other,parent=(self.qs,self.ds,self.dt,self.ps) if side=='forward' else (self.qt,self.dt,self.ds,self.pt)
                node=q.popleft();self.closed.add(node)
                if node in other and dist[node]+other[node]<self.best:self.best=dist[node]+other[node];self.meet=node
                for v in neighbors(node,self.n,self.walls):
                    if v not in dist:dist[v]=dist[node]+1;parent[v]=node;q.append(v);self.discovered.add(v)
                    if v in other and dist[v]+other[v]<self.best:self.best=dist[v]+other[v];self.meet=v
                if not q or dist[q[0]]!=self.layer_depth:self.depth_side=None
                if not self.qs or not self.qt or self.ds[self.qs[0]]+self.dt[self.qt[0]]>=self.best:self.finish()
        if node is not None:self.expanded+=1
        self.elapsed_ms+=(perf_counter()-start)*1000
        return {'node':node,'side':side,'cost':cost,'done':self.done,'path':self.path if self.done else [],'expanded':self.expanded,'runtime_ms':self.elapsed_ms}
