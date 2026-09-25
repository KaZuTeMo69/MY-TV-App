/* Watchlog · Shared UI: nav, icons, poster cards and rows, cast/director rows, segment slider */
/* ============ views ============ */
const ICONS={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="7" height="9" rx="1.5"/><rect x="14" y="4" width="7" height="9" rx="1.5"/><path d="M3 17h18M3 21h12"/></svg>',
 shows:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m8 2 4 4 4-4"/></svg>',
 movies:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 4v5M12 4v5M17 4v5"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z"/></svg>'
};
const NAV=[['home','Home'],['list','My List'],['search','Search'],['gear','Settings']];
function renderNav(route){
  $('#nav').innerHTML=NAV.map(([k,l])=>`<button class="${route===k?'on':''}" onclick="go('${k}')">${ICONS[k]}<span>${l}</span></button>`).join('');
}
window.go=r=>{location.hash='#/'+r};

function posterCard(sh){
  const tv=S.tvm[sh.id],img=tv?.img;
  const st=showState(sh);
  const up=upcomingEp(sh.id);
  const nw=newEp(sh.id);
  const tag=nw?`<span class="pill green tag">NEW</span>`
    :up&&st!=='plan'?`<span class="pill amber tag">ep ${fmtDate(up.air)}</span>`
    :st==='completed'?'<span class="pill green tag">✓ done</span>'
    :st==='uptodate'?'<span class="pill gold tag">up to date</span>'
    :tv?.status==='Ended'&&st==='watching'?'<span class="pill red tag">ended</span>':'';
  return `<a class="pc" href="#/show/${sh.id}">
    ${img?`<img loading="lazy" src="${img}" alt="">`:`<div class="ph">${esc(sh.title)}</div>`}
    ${tag}${sh.favorite?'<span class="fav">★</span>':''}
  </a>`;
}

function showRow(sh){
  const tv=S.tvm[sh.id],wc=watchedCount(sh.id);
  const tot=tv?.eps?tv.eps.filter(e=>!epFuture(e)).length:0;
  const nx=nextEp(sh.id),up=upcomingEp(sh.id),nw=newEp(sh.id);
  const sub=[tot?`${wc}/${tot}`:wc?`${wc} eps`:'',
    nw?`NEW S${nw.s} E${nw.e}`:nx?`next S${nx.s} E${nx.e}`:up?`new ep ${fmtDate(up.air)}`:'',
    tv?.status==='Ended'?'ended':''].filter(Boolean).join(' · ');
  return `<a class="mrow" href="#/show/${sh.id}">
    <div class="mp">${tv?.img?`<img loading="lazy" src="${tv.img}">`:'📺'}</div>
    <div class="mi"><div class="mt">${esc(sh.title)}${sh.favorite?' ★':''}</div>
    <div class="ms">${sub}</div></div>
  </a>`;
}

function segSlider(cur,setter){
  const opts=[['all','All'],['shows','Shows'],['movies','Movies']];
  const idx=opts.findIndex(o=>o[0]===cur);
  return `<div class="seg"><div class="thumb" style="transform:translateX(${idx*100}%)"></div>
    ${opts.map(([k,l])=>`<button class="${cur===k?'on':''}" onclick="${setter}('${k}')">${l}</button>`).join('')}</div>`;
}

const CAST_SHOWN=8;
let castOpen=false;
function castCard(c){
  const inner=`<div class="castp">${c.img?`<img loading="lazy" src="${c.img}">`:'👤'}</div>
    <div class="castt"><div class="castn">${esc(c.n)}</div><div class="castr">${esc(c.c)}</div></div>`;
  // only clickable when we have a TMDB person id — TVmaze-sourced cast has none
  return c.pid?`<a class="castc" href="#/person/${c.pid}">${inner}</a>`
              :`<div class="castc">${inner}</div>`;
}
function castRow(cast){
  if(!cast||!cast.length)return'';
  const hidden=cast.length-CAST_SHOWN;
  const shown=castOpen?cast:cast.slice(0,CAST_SHOWN);
  return `<div class="sec" style="margin-top:18px"><h2>Cast</h2></div>
  <div class="row-scroll">${shown.map(castCard).join('')}
    ${!castOpen&&hidden>0?`<button class="castmore" onclick="castOpen=true;render(false)">+ ${hidden} more</button>`:''}</div>`;
}
function dirRow(dir){
  if(!dir||!dir.length)return'';
  return `<div class="sec" style="margin-top:18px"><h2>${dir.length>1?'Directors':'Director'}</h2></div>
  ${dir.map(d=>`<a class="crd" href="#/person/${d.pid}/d">
    <div class="cp">${d.img?`<img loading="lazy" src="${d.img}">`:'🎬'}</div>
    <div class="ct"><b>${esc(d.n)}</b><span>Director</span></div>
    <span class="cy">›</span></a>`).join('')}`;
}

function movieRow(m){
  const p=getPoster(m),r=S.movieRatings[m.title];
  const up=m.releaseDate&&m.releaseDate>=_today();
  const sub=m.status==='watched'?fmtDate(m.watchDate)
    :up?`releases ${fmtDate(m.releaseDate)}`
    :(m.releaseDate?m.releaseDate.slice(0,4):'');
  return `<a class="mrow" href="#/movie/${encodeURIComponent(m.id)}">
    <div class="mp">${p?`<img loading="lazy" src="${p}">`:'🎬'}</div>
    <div class="mi"><div class="mt">${esc(m.title)}</div>
    <div class="ms">${sub}${m.runtime?' · '+fmtMin(m.runtime):''}${m.rewatch?` · ×${m.rewatch+1}`:''}${r!=null?` · you: ${r}`:''}</div></div>
    <button class="act check ${m.status==='watched'?'on':''}" onclick="event.preventDefault();event.stopPropagation();tgMovie(${jsa(m.id)})">✓</button>
  </a>`;
}
function movieCard(m){
  const p=getPoster(m);
  const up=m.releaseDate&&m.releaseDate>=_today();
  const tag=m.status==='watched'?'<span class="pill green tag">✓</span>'
    :up?`<span class="pill amber tag">${fmtDate(m.releaseDate)}</span>`:'';
  return `<a class="pc" href="#/movie/${encodeURIComponent(m.id)}">
    ${p?`<img loading="lazy" src="${p}">`:`<div class="ph">${esc(m.title)}</div>`}
    ${tag}${m.favorite?'<span class="fav">★</span>':''}</a>`;
}
