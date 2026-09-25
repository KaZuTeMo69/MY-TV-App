/* Watchlog · Title preview and person (cast/crew) pages */
let prevCache={};
async function loadPreview(type,id){
  const k=type+id;
  if(prevCache[k])return prevCache[k];
  const d=await tmdbFetch(`/${type==='tv'?'tv':'movie'}/${id}?append_to_response=videos,credits`);
  const vids=d.videos?.results||[];
  const tr=vids.find(v=>v.site==='YouTube'&&v.type==='Trailer'&&v.official)||vids.find(v=>v.site==='YouTube'&&v.type==='Trailer')||vids.find(v=>v.site==='YouTube');
  prevCache[k]={
    title:type==='tv'?(d.name||''):(d.title||''),
    backdrop:d.backdrop_path?`https://image.tmdb.org/t/p/w780${d.backdrop_path}`:'',
    poster:d.poster_path?`https://image.tmdb.org/t/p/w342${d.poster_path}`:'',
    rating:d.vote_average?+d.vote_average.toFixed(1):null,
    year:((type==='tv'?d.first_air_date:d.release_date)||'').slice(0,4),
    date:(type==='tv'?d.first_air_date:d.release_date)||'',
    runtime:type==='tv'?null:(d.runtime||null),
    seasons:type==='tv'?(d.number_of_seasons||null):null,
    status:d.status||'',
    genres:(d.genres||[]).map(g=>normGenre(g.name)).slice(0,3),
    overview:(d.overview||'').slice(0,420),
    trailer:tr?tr.key:'',
    cast:(d.credits?.cast||[]).slice(0,14).map(c=>({n:c.name||'',c:c.character||'',pid:c.id,img:c.profile_path?`https://image.tmdb.org/t/p/w185${c.profile_path}`:''})),
    dir:type==='movie'?dirList(d.credits?.crew):[]
  };
  return prevCache[k];
}
let personCache={},bioOpen=false,moreOpen={};
// TV genre ids for talk shows / news / reality — these flood an actor's credit list
const JUNK_TV=[10767,10763,10764];
function credList(arr,job){
  const seen=new Set(),out=[];
  for(const c of (arr||[])){
    if(c.media_type!=='movie'&&c.media_type!=='tv')continue;
    if(job&&c.job!==job)continue;
    if(seen.has(c.media_type+c.id))continue;
    if(!job&&/^self\b/i.test(c.character||''))continue;
    if(c.media_type==='tv'&&(c.genre_ids||[]).some(g=>JUNK_TV.includes(g)))continue;
    const t=c.media_type==='tv'?(c.name||''):(c.title||'');
    if(!t)continue;
    seen.add(c.media_type+c.id);
    out.push({id:c.id,type:c.media_type,t,
      y:((c.media_type==='tv'?c.first_air_date:c.release_date)||'').slice(0,4),
      sub:job?job:(c.character||''),pop:c.popularity||0,
      img:c.poster_path?`https://image.tmdb.org/t/p/w185${c.poster_path}`:''});
  }
  return out.sort((a,b)=>b.pop-a.pop);
}
async function loadPerson(pid){
  if(personCache[pid])return personCache[pid];
  const d=await tmdbFetch(`/person/${pid}?append_to_response=combined_credits,external_ids`);
  const x=d.external_ids||{};
  personCache[pid]={
    name:d.name||'',
    img:d.profile_path?`https://image.tmdb.org/t/p/w342${d.profile_path}`:'',
    bio:(d.biography||'').trim(),
    born:d.birthday||'',died:d.deathday||'',place:d.place_of_birth||'',
    known:d.known_for_department||'',
    ig:x.instagram_id||'',tw:x.twitter_id||'',imdb:x.imdb_id||'',
    acting:credList(d.combined_credits?.cast),
    directed:credList(d.combined_credits?.crew,'Director')
  };
  return personCache[pid];
}
function ageFrom(born,died){
  if(!born)return null;
  const b=parseDay(born),e=died?parseDay(died):new Date();
  if(isNaN(b))return null;
  let a=e.getFullYear()-b.getFullYear();
  const m=e.getMonth()-b.getMonth();
  if(m<0||(m===0&&e.getDate()<b.getDate()))a--;
  return a>=0&&a<130?a:null;
}
const CRED_SHOWN=12;
function credSection(title,list,key){
  if(!list.length)return'';
  const open=moreOpen[key],shown=open?list:list.slice(0,CRED_SHOWN);
  return `<div class="sec" style="margin-top:18px"><h2>${title}</h2><span class="all">${list.length}</span></div>
  ${shown.map(c=>`<a class="crd" href="#/preview/${c.type}/${c.id}">
    <div class="cp">${c.img?`<img loading="lazy" src="${c.img}">`:(c.type==='tv'?'📺':'🎬')}</div>
    <div class="ct"><b>${esc(c.t)}</b><span>${esc(c.sub||(c.type==='tv'?'TV':'Film'))}</span></div>
    <span class="cy">${c.y||''}</span></a>`).join('')}
  ${!open&&list.length>CRED_SHOWN?`<button class="cta sub" onclick="moreOpen['${key}']=true;render(false)">Show ${list.length-CRED_SHOWN} more</button>`:''}`;
}
function vPerson(pid,mode){
  const p=personCache[pid];
  if(!p){
    loadPerson(pid).then(()=>render(false))
      .catch(()=>{$('#app').innerHTML='<div class="empty">Could not load this person.</div>'});
    return'<div class="empty">Loading…</div>';
  }
  const age=ageFrom(p.born,p.died);
  const facts=[
    p.born?`Born ${fmtDate(p.born)}${age!=null&&!p.died?` · ${age}`:''}`:'',
    p.died?`Died ${fmtDate(p.died)}${age!=null?` · aged ${age}`:''}`:'',
    p.place||''
  ].filter(Boolean).map(f=>`<div>${esc(f)}</div>`).join('');
  const soc=[
    p.ig?`<a href="https://instagram.com/${p.ig}" target="_blank" rel="noopener">Instagram</a>`:'',
    p.tw?`<a href="https://x.com/${p.tw}" target="_blank" rel="noopener">X</a>`:'',
    p.imdb?`<a href="https://www.imdb.com/name/${p.imdb}/" target="_blank" rel="noopener">IMDb</a>`:''
  ].filter(Boolean).join('');
  const long=p.bio.length>420;
  const bio=p.bio?`<div class="set" style="margin-top:18px"><h3>About</h3>
    <div class="bio">${esc(bioOpen||!long?p.bio:p.bio.slice(0,420).trim()+'…')}</div>
    ${long?`<div class="biotg" onclick="bioOpen=!bioOpen;render(false)">${bioOpen?'Show less':'Read more'}</div>`:''}</div>`:'';
  const acting=credSection('Acting',p.acting,pid+'a');
  const directed=credSection('Directed',p.directed,pid+'d');
  return `<header class="hdr" style="display:flex;align-items:center;gap:10px">
    <button class="iconbtn" onclick="history.back()">‹</button></header>
  <div class="phdr">
    <div class="pimg">${p.img?`<img src="${p.img}">`:'👤'}</div>
    <div class="pmeta"><h1>${esc(p.name)}</h1>
      <div class="pfacts">${facts||'<div>No details on file.</div>'}</div>
      ${soc?`<div class="soc">${soc}</div>`:''}</div>
  </div>
  ${bio}
  ${mode==='d'?directed+acting:acting+directed}
  ${!p.acting.length&&!p.directed.length?'<div class="empty">No credits listed.</div>':''}`;
}
function vPreview(type,id){
  const p=prevCache[type+id];
  if(!p){loadPreview(type,id).then(()=>render(false)).catch(()=>{$('#app').innerHTML='<div class="empty">Could not load this title.</div>'});
    return'<div class="empty">Loading…</div>'}
  const tv=type==='tv';
  const inLib=tv?findLibShow(id,p.title,p.year):findLibMovie(id,p.title,p.year);
  const chips=[
    p.rating?`<span class="pill gold">★ ${p.rating}</span>`:'',
    p.year?`<span class="pill">${p.year}</span>`:'',
    p.seasons?`<span class="pill">${p.seasons} season${p.seasons>1?'s':''}</span>`:'',
    p.runtime?`<span class="pill">${fmtMin(p.runtime)}</span>`:'',
    ...p.genres.map(g=>`<span class="pill">${esc(g)}</span>`)
  ].join('');
  return `<div class="dt-hero">
    ${p.backdrop||p.poster?`<img src="${p.backdrop||p.poster}">`:`<div style="height:100%;background:var(--card2)"></div>`}
    <div class="fade"></div>
    <div class="top"><button class="iconbtn" onclick="history.back()">‹</button><span></span></div>
    <div class="dt-title"><h1>${esc(p.title)}</h1><div class="meta">${chips}</div></div>
  </div>
  <div class="dt-body">
    ${inLib?`<button class="cta sub" onclick="prevOpenLib('${type}',${id})">Open in My List ✓</button>`
      :`<button class="cta" onclick="prevAdd('${type}',${id})">+ Add to My List</button>`}
    ${p.trailer?`<a class="cta sub" style="margin-top:10px" href="https://www.youtube.com/watch?v=${p.trailer}" target="_blank" rel="noopener">▶ Watch trailer</a>`:''}
    ${p.overview?`<div class="set" style="margin-top:16px"><h3>About</h3><p>${esc(p.overview)}</p></div>`:''}
    ${castRow(p.cast)}
    ${dirRow(p.dir)}
  </div>`;
}
window.prevAdd=async(type,id)=>{
  const p=prevCache[type+id];if(!p)return;
  if(type==='movie')await quickAddMovie(p.title,p.date,id);
  else await quickAddTv(p.title,id,p.date);
};
window.prevOpenLib=(type,id)=>{
  const p=prevCache[type+id];if(!p)return;
  if(type==='movie'){
    const m=findLibMovie(id,p.title,p.year);
    if(m)location.hash='#/movie/'+encodeURIComponent(m.id);
  }else{
    const s=findLibShow(id,p.title,p.year);
    if(s)location.hash='#/show/'+s.id;
  }
};
