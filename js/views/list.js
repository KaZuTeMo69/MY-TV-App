/* Watchlog · My List screen and its filters */
let LQ={seg:'all',status:'all',screen:'all',genre:'all',fav:false};
window.setSeg=v=>{
  LQ.seg=v;
  if(v==='movies'&&['watching','uptodate','later'].includes(LQ.status))LQ.status='all';
  // honest genre reset when it doesn't exist in the new segment
  if(LQ.genre!=='all'){
    const g=new Set(libItemsFor(v).flatMap(itemGenres));
    if(!g.has(LQ.genre))LQ.genre='all';
  }
  if(LQ.screen!=='all'&&LQ.screen!=='__other'){
    const p=new Set(libItemsFor(v).flatMap(it=>itemProv(it).map(x=>x.n)));
    if(!p.has(LQ.screen))LQ.screen='all';
  }
  render(false)};
window.setLQ=(k,v)=>{LQ[k]=v;render(false)};
window.setLView=v=>{S.prefs.listView=v;saveOne('prefs');render(false)};
window.goFavs=()=>{
  LQ={seg:'all',status:'all',screen:'all',genre:'all',fav:true};
  if(location.hash==='#/list')render();else location.hash='#/list';
};

function libItemsFor(seg){
  const shows=Object.values(S.shows).filter(s=>watchedCount(s.id)>0||s.followed||s.userStatus).map(s=>({...s,_t:'s'}));
  const movies=Object.values(S.movies).map(m=>({...m,_t:'m'}));
  return seg==='shows'?shows:seg==='movies'?movies:[...shows,...movies];
}
function libItems(){return libItemsFor(LQ.seg)}
function itemGenres(it){
  const g=it._t==='s'?(S.tvm[it.id]?.genres||[]):(getMeta(it)?.genres||[]);
  return [...new Set(g.map(normGenre))];
}
function itemProv(it){
  let p=provFor((it._t==='s'?'s':'m')+it.id)?.p||[];
  if(it._t==='s'&&S.tvm[it.id]?.network&&!p.length)p=[{n:S.tvm[it.id].network,l:''}];
  const seen={},out=[];
  p.forEach(x=>{const n=normProv(x.n);if(n&&!seen[n]){seen[n]=1;out.push({n,l:x.l})}});
  return out;
}
function vList(){
  let items=libItems();
  // options for dropdowns (built from current segment's library)
  const genres=[...new Set(items.flatMap(itemGenres))].sort();
  const pCount={};items.forEach(it=>itemProv(it).forEach(p=>pCount[p.n]=(pCount[p.n]||0)+1));
  const provRank=Object.entries(pCount).sort((a,b)=>b[1]-a[1]);
  const topProv=provRank.slice(0,10);
  const otherCount=provRank.slice(10).reduce((a,x)=>a+x[1],0);
  const topSet=new Set(topProv.map(x=>x[0]));
  // apply filters
  if(LQ.status!=='all')items=items.filter(it=>uniState(it).includes(LQ.status));
  if(LQ.genre!=='all')items=items.filter(it=>itemGenres(it).includes(LQ.genre));
  if(LQ.fav)items=items.filter(it=>it.favorite);
  if(LQ.screen==='__other')items=items.filter(it=>{const ps=itemProv(it);return ps.length&&ps.every(p=>!topSet.has(p.n))});
  else if(LQ.screen!=='all')items=items.filter(it=>itemProv(it).some(p=>p.n===LQ.screen));
  // sort
  if(LQ.status==='upcoming'){
    const key=it=>it._t==='m'?(it.releaseDate||'9999'):(upcomingEp(it.id)?.air||'9999');
    items.sort((a,b)=>key(a).localeCompare(key(b)));
  }else{
    const key=it=>it._t==='s'?lastWatch(it.id):(it.watchDate||it.addedAt||'');
    items.sort((a,b)=>key(b).localeCompare(key(a))||(a.title.localeCompare(b.title)));
  }
  const statOpts=USTAT.filter(([k])=>{
    if(LQ.seg==='movies'&&['watching','uptodate','later'].includes(k))return false;
    return true;
  });
  const grid=S.prefs.listView!=='list';
  const provLogo=n=>{for(const it of libItems()){const p=itemProv(it).find(x=>x.n===n&&x.l);if(p)return p.l}return''};
  return `<header class="hdr"><div class="name">My List</div>
    ${segSlider(LQ.seg,'setSeg')}
    <div style="display:flex;gap:8px;flex:0 0 auto">
      <button class="viewtg ${LQ.fav?'on':''}" onclick="setLQ('fav',${LQ.fav?'false':'true'})" aria-label="Favorites only">${LQ.fav?'★':'☆'}</button>
      <button class="viewtg" onclick="setLView('${grid?'list':'grid'}')">${grid?'☰':'▦'}</button>
    </div></header>
  <div class="chips">
    ${statOpts.map(([k,l])=>`<button class="chip ${LQ.status===k?'on':''}" onclick="setLQ('status','${k}')">${l}</button>`).join('')}
  </div>
  <div class="filters">
    <select onchange="setLQ('screen',this.value)">
      <option value="all">Screen: All</option>
      ${topProv.map(([p,c])=>`<option value="${esc(p)}" ${LQ.screen===p?'selected':''}>${esc(p)} (${c})</option>`).join('')}
      ${otherCount?`<option value="__other" ${LQ.screen==='__other'?'selected':''}>Other (${otherCount})</option>`:''}
    </select>
    <select onchange="setLQ('genre',this.value)">
      <option value="all">Genre: All</option>
      ${genres.map(g=>`<option value="${esc(g)}" ${LQ.genre===g?'selected':''}>${esc(g)}</option>`).join('')}
    </select>
  </div>
  ${LQ.screen!=='all'&&provLogo(LQ.screen)?`<div style="display:flex;align-items:center;gap:8px;margin:2px 2px 10px;font-size:12px;color:var(--tx2)"><img src="${provLogo(LQ.screen)}" style="width:22px;height:22px;border-radius:6px">${esc(LQ.screen)} · ${items.length} titles</div>`:''}
  ${grid?`<div class="grid">${items.map(it=>it._t==='s'?posterCard(it):movieCard(it)).join('')||'<div class="empty">Nothing matches these filters.</div>'}</div>`
    :(items.map(it=>it._t==='s'?showRow(it):movieRow(it)).join('')||'<div class="empty">Nothing matches these filters.</div>')}`;
}
