/* Watchlog · Search screen and TMDB suggestions */
let srchQ='',srchRes=[],srchBusy=false,_srchSeq=0,_srchT=null,srchSeg='all',SQ={genre:'all',time:'week'},suggCache={},suggLoading=false;
window.setSrchSeg=v=>{srchSeg=v;render(false);loadSugg()};
window.setSQ=(k,v)=>{SQ[k]=v;render(false);loadSugg()};
const TIME_OPTS=[['week','Trending this week'],['popular','Popular'],['top','Top rated']];
const suggKey=()=>`${srchSeg}:${SQ.time}`;

async function fetchSuggPage(page){
  const t=SQ.time;
  const inter=(a,b)=>{const out=[];const n=Math.max(a.length,b.length);
    for(let i=0;i<n;i++){if(a[i])out.push(a[i]);if(b[i])out.push(b[i])}return out};
  if(t==='week'){
    const path=srchSeg==='all'?'/trending/all/week':srchSeg==='shows'?'/trending/tv/week':'/trending/movie/week';
    const j=await tmdbFetch(`${path}?page=${page}`);
    return {items:(j.results||[]).filter(x=>srchSeg!=='all'||x.media_type==='movie'||x.media_type==='tv')
      .map(x=>({...x,media_type:x.media_type||(srchSeg==='shows'?'tv':'movie')})),
      more:page<(j.total_pages||1)};
  }
  const ep=t==='popular'?'popular':'top_rated';
  if(srchSeg==='shows'){
    const j=await tmdbFetch(`/tv/${ep}?page=${page}`);
    return {items:(j.results||[]).map(x=>({...x,media_type:'tv'})),more:page<(j.total_pages||1)};
  }
  if(srchSeg==='movies'){
    const j=await tmdbFetch(`/movie/${ep}?page=${page}`);
    return {items:(j.results||[]).map(x=>({...x,media_type:'movie'})),more:page<(j.total_pages||1)};
  }
  const [jm,jt]=await Promise.all([tmdbFetch(`/movie/${ep}?page=${page}`),tmdbFetch(`/tv/${ep}?page=${page}`)]);
  return {items:inter((jm.results||[]).map(x=>({...x,media_type:'movie'})),(jt.results||[]).map(x=>({...x,media_type:'tv'}))),
    more:page<Math.max(jm.total_pages||1,jt.total_pages||1)};
}
async function loadSugg(more=false){
  if(!S.keys.tmdb||srchQ||suggLoading)return;
  const key=suggKey();
  let c=suggCache[key];
  if(!more&&c&&Date.now()-c.at<3600e3){paintSugg();return}
  suggLoading=true;
  try{
    const page=more&&c?c.page+1:1;
    const r=await fetchSuggPage(page);
    if(more&&c){c.items=[...c.items,...r.items];c.page=page;c.more=r.more}
    else suggCache[key]={at:Date.now(),items:r.items,page:1,more:r.more};
  }catch(e){}
  suggLoading=false;
  paintSugg();
}
window.suggMore=()=>{const b=$('#suggmore');if(b){b.textContent='Loading…';b.disabled=true}loadSugg(true)};
function visSugg(){
  const c=suggCache[suggKey()];
  if(!c)return null;
  let items=c.items;
  if(SQ.genre!=='all')items=items.filter(x=>(x.genre_ids||[]).some(g=>normGenre(TMDB_GENRES[g]||'')===normGenre(SQ.genre)));
  return {items,more:c.more};
}
function suggCards(){
  const v=visSugg();
  if(!v)return S.keys.tmdb?'<div class="empty">Loading suggestions…</div>':'<div class="empty">Add your TMDB key in Settings to see suggestions.</div>';
  const title=TIME_OPTS.find(t=>t[0]===SQ.time)[1]+(srchSeg==='shows'?' · shows':srchSeg==='movies'?' · movies':'');
  if(!v.items.length)return`<div class="sec"><h2>${title}</h2></div><div class="empty">Nothing matches this genre.</div>`;
  return `<div class="sec"><h2>${title}</h2></div><div class="grid">${v.items.map((x,i)=>{
    const tv=x.media_type==='tv';
    const t=tv?(x.name||''):(x.title||'');
    const img=x.poster_path?`https://image.tmdb.org/t/p/w342${x.poster_path}`:'';
    const inLib=!!libMatch(x);
    return `<div class="pc" onclick="suggOpen(${i})">
      ${img?`<img loading="lazy" src="${img}">`:`<div class="ph">${esc(t)}</div>`}
      <span class="pill tag">${tv?'TV':'Film'}${x.vote_average?` ★${(+x.vote_average).toFixed(1)}`:''}</span>
      <button class="pill ${inLib?'green':'gold'} fav" style="top:auto;bottom:7px;right:7px" onclick="event.stopPropagation();suggAdd(${i})">${inLib?'✓':'+'}</button>
    </div>`}).join('')}</div>
  ${v.more?`<button class="cta sub" id="suggmore" style="margin-top:14px" onclick="suggMore()">Load more</button>`:''}`;
}
function paintSugg(){const el=$('#srchres');if(el&&!srchQ)el.innerHTML=suggCards()}
window.suggOpen=i=>{
  const v=visSugg();const x=v?.items[i];if(!x)return;
  location.hash=`#/preview/${x.media_type}/${x.id}`;
};
window.suggAdd=async i=>{
  const v=visSugg();const x=v?.items[i];if(!x)return;
  if(x.media_type==='movie')await quickAddMovie(x.title,x.release_date,x.id);
  else await quickAddTv(x.name,x.id,x.first_air_date);
  paintSugg();
};

function srchResults(){
  if(!srchQ)return suggCards();
  if(srchBusy)return'<div class="empty">Searching…</div>';
  if(!srchRes.length)return srchQ.length>=2?'<div class="empty">No results.</div>':suggCards();
  return srchRes.map((x,i)=>{
    const tv=x._type==='tv';
    const img=x.poster_path?`https://image.tmdb.org/t/p/w185${x.poster_path}`:(x.image?.medium||'');
    const yr=((tv?x.first_air_date:x.release_date)||x.premiered||'').slice(0,4);
    const title=tv?(x.name||''):(x.title||x.name||'');
    const inLib=!!libMatch(x);
    return `<div class="mrow" onclick="srchOpen(${i})">
      <div class="mp">${img?`<img src="${img}">`:tv?'📺':'🎬'}</div>
      <div class="mi"><div class="mt">${esc(title)}</div>
      <div class="ms">${tv?'TV':'Film'}${yr?' · '+yr:''}${x.vote_average?' · ★'+(+x.vote_average).toFixed(1):''}</div></div>
      <button class="btn ${inLib?'':'gold'}" onclick="event.stopPropagation();srchAdd(${i})">${inLib?'Open':'+ Add'}</button>
    </div>`}).join('');
}
window.srchOpen=i=>{const x=srchRes[i];if(!x)return;
  if(x._src==='tvm'){ // TVmaze results carry TVmaze ids, which the TMDB preview can't open
    const ex=libMatch(x);
    if(ex)location.hash='#/show/'+ex.id;else toast('Add a TMDB key in Settings to preview titles');
    return}
  if(x.id)location.hash=`#/preview/${x._type==='tv'?'tv':'movie'}/${x.id}`;};
window.srchAdd=async i=>{
  const x=srchRes[i];if(!x)return;
  if(x._src==='tvm'){
    const ex=libMatch(x);
    if(ex)location.hash='#/show/'+ex.id;
    else await addShow({tvdb:x.externals?.thetvdb||('m_'+x.id),name:x.name,mid:x.id,tmdbId:0});
  }
  else if(x._type==='tv')await quickAddTv(x.name,x.id,x.first_air_date);
  else await quickAddMovie(x.title,x.release_date,x.id);
  const el=$('#srchres');if(el)el.innerHTML=srchResults();
};
window.onSrchInput=v=>{
  srchQ=v;
  const clr=$('#srchclr');if(clr)clr.style.display=v?'flex':'none';
  clearTimeout(_srchT);
  const el=$('#srchres');
  if(v.length<2){_srchSeq++;srchRes=[];srchBusy=false;if(el)el.innerHTML=srchResults();return}
  if(srchSeg!=='all'){srchSeg='all';const seg=$('#srchseg');if(seg)seg.outerHTML=srchSegHtml()}
  _srchT=setTimeout(async()=>{
    // only the newest query may paint; a slow older response is dropped
    const seq=++_srchSeq;
    srchBusy=true;if($('#srchres'))$('#srchres').innerHTML=srchResults();
    let res=[];
    try{
      if(S.keys.tmdb){
        const j=await tmdbFetch(`/search/multi?query=${encodeURIComponent(v)}`);
        res=(j.results||[]).filter(x=>x.media_type==='movie'||x.media_type==='tv')
          .map(x=>({...x,_type:x.media_type})).slice(0,15);
      }else{
        const r=await fetch(`${TVM}/search/shows?q=${encodeURIComponent(v)}`);
        res=(await r.json()).slice(0,12).map(x=>({...x.show,_type:'tv',_src:'tvm'}));
      }
    }catch(e){res=[]}
    if(seq!==_srchSeq||v!==srchQ)return;
    srchRes=res;srchBusy=false;const el2=$('#srchres');if(el2)el2.innerHTML=srchResults();
  },380);
};
window.clearSrch=()=>{
  const box=$('#srchbox');
  if(box){box.value='';box.focus()}
  onSrchInput('');
};
function srchSegHtml(){
  return `<span id="srchseg" style="display:contents">${segSlider(srchSeg,'setSrchSeg')}</span>`;
}
function vSearch(){
  setTimeout(loadSugg,50);
  return `<header class="hdr"><div class="name">Search</div>${srchSegHtml()}</header>
  <div class="filters" style="margin-top:0">
    <select onchange="setSQ('time',this.value)">
      ${TIME_OPTS.map(([k,l])=>`<option value="${k}" ${SQ.time===k?'selected':''}>${l}</option>`).join('')}
    </select>
    <select onchange="setSQ('genre',this.value)">
      <option value="all">Genre: All</option>
      ${[...new Set(Object.values(TMDB_GENRES).map(normGenre))].sort().map(g=>`<option ${SQ.genre===g?'selected':''}>${g}</option>`).join('')}
    </select>
  </div>
  <div class="srch"><div class="sw">
    <input id="srchbox" placeholder="Search shows & movies…" value="${esc(srchQ)}" oninput="onSrchInput(this.value)">
    <button class="clr" id="srchclr" style="display:${srchQ?'flex':'none'}" onclick="clearSrch()" aria-label="Clear search">✕</button>
  </div></div>
  <div id="srchres">${srchResults()}</div>`;
}
