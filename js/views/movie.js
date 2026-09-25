/* Watchlog · Movie page and movie actions */
window.rmMovie=async id=>{
  const m=S.movies[id];if(!m)return;
  if(!confirm(`Remove "${m.title}" from your library? This cannot be undone (except via backup).`))return;
  delete S.movies[id];
  delete S.prov['m'+id];delete S.tmdbMeta[mkey(m)];delete S.tmdbPosters[mkey(m)];
  // ratings come from the TV Time export keyed by title, so only drop them if no other movie uses it
  if(!Object.values(S.movies).some(x=>x.title===m.title))delete S.movieRatings[m.title];
  await save();toast('Removed');go('list');
};

function vMovie(id){
  const m=S.movies[id];
  if(!m)return'<div class="empty">Movie not found.</div>';
  const meta=getMeta(m);
  if(S.keys.tmdb&&(meta===undefined||(meta&&meta.cv!==2))&&!_metaTried.has(m.id)){
    _metaTried.add(m.id);tmdbMovieMeta(m).then(()=>render(false))}
  const r=S.movieRatings[m.title];
  const up=m.releaseDate&&m.releaseDate>=_today();
  const art=meta?.backdrop||meta?.poster||getPoster(m);
  const chips=[
    up?`<span class="pill amber">releases ${fmtDate(m.releaseDate)}</span>`:'',
    meta?.rating?`<span class="pill gold">★ ${meta.rating}</span>`:'',
    r!=null?`<span class="pill gold">you: ${r}</span>`:'',
    (meta?.date||m.releaseDate)?`<span class="pill">${(meta?.date||m.releaseDate).slice(0,4)}</span>`:'',
    (meta?.runtime||m.runtime)?`<span class="pill">${fmtMin(meta?.runtime||m.runtime)}</span>`:'',
    m.rewatch?`<span class="pill">watched ×${m.rewatch+1}</span>`:'',
    ...(meta?.genres||[]).map(g=>`<span class="pill">${esc(g)}</span>`)
  ].join('');
  return `<div class="dt-hero">
    ${art?`<img src="${art}">`:`<div style="height:100%;background:var(--card2)"></div>`}
    <div class="fade"></div>
    <div class="top"><button class="iconbtn" onclick="history.back()">‹</button>
    <button class="iconbtn" onclick="tgMovieFav(${jsa(id)})">${m.favorite?'★':'☆'}</button></div>
    <div class="dt-title"><h1>${esc(m.title)}</h1><div class="meta">${chips}</div></div>
  </div>
  <div class="dt-body">
    ${m.status==='watched'
      ?`<button class="cta sub" onclick="tgMovie(${jsa(id)})">Watched ${m.watchDate?fmtDate(m.watchDate):''} ✓ · tap to undo</button>
        <button class="cta sub" style="margin-top:10px" onclick="rewatchMovie(${jsa(id)})">↻ Watched it again</button>
        ${(m.history||[]).length?`<p class="hist">Earlier: ${m.history.map(d=>fmtDate(d)).join(' · ')}</p>`:''}`
      :`<button class="cta" onclick="tgMovie(${jsa(id)})">Mark as watched</button>`}
    ${meta?.trailer?`<a class="cta sub" style="margin-top:10px" href="https://www.youtube.com/watch?v=${meta.trailer}" target="_blank" rel="noopener">▶ Watch trailer</a>`:''}
    ${meta?watchBlock('m'+m.id,m.title):''}
    ${meta?.overview?`<div class="set" style="margin-top:16px"><h3>About</h3><p>${esc(meta.overview)}</p></div>`:''}
    ${castRow(meta?.cast)}
    ${dirRow(meta?.dir)}
    ${!S.keys.tmdb?'<div class="set" style="margin-top:16px"><p>Add a free TMDB key in Settings to load poster, rating, genres and synopsis here.</p></div>':''}
    <button class="btn danger" style="width:100%;margin-top:16px" onclick="rmMovie(${jsa(id)})">Remove from library</button>
  </div>`;
}
window.tgMovieFav=async id=>{const m=S.movies[id];if(!m)return;m.favorite=!m.favorite;await saveOne('movies');render(false)};
// m.watchDate is the latest watch; m.history holds the dates of earlier ones
window.tgMovie=async id=>{
  const m=S.movies[id];if(!m)return;
  if(m.status==='watched'){
    const h=m.history||[];
    if(h.length){ // undo only the latest rewatch
      if(!confirm(`Remove your latest watch${m.watchDate?` (${fmtDate(m.watchDate)})`:''}?`))return;
      m.watchDate=h.pop();m.rewatch=Math.max(0,(m.rewatch||0)-1);toast('Latest watch removed');
    }else{
      if(m.watchDate&&m.watchDate!==_today()&&!confirm(`Unmark "${m.title}"? Your watch on ${fmtDate(m.watchDate)} will be removed.`))return;
      m.status='watchlist';m.watchDate=null;toast('Moved to watchlist');
    }
  }
  else{m.status='watched';m.watchDate=_today();toast('Watched ✓')}
  await saveOne('movies');render(false);
};
window.rewatchMovie=async id=>{
  const m=S.movies[id];if(!m||m.status!=='watched')return;
  if(m.watchDate)(m.history=m.history||[]).push(m.watchDate);
  m.watchDate=_today();m.rewatch=(m.rewatch||0)+1;
  await saveOne('movies');toast(`Watched ×${m.rewatch+1} ✓`);render(false);
};
