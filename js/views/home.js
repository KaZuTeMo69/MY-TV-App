/* Watchlog · Home screen */
function vHome(){
  const watchNow=Object.values(S.shows)
    .filter(s=>watchedCount(s.id)>0&&showState(s)==='watching'&&nextEp(s.id)!==null||
      (watchedCount(s.id)>0&&showState(s)==='watching'&&!S.tvm[s.id]?.eps))
    .sort((a,b)=>{
      const na=newEp(a.id)?1:0,nb=newEp(b.id)?1:0;
      if(na!==nb)return nb-na;
      return lastWatch(b.id).localeCompare(lastWatch(a.id))});
  const upcoming=Object.values(S.shows)
    .filter(s=>watchedCount(s.id)>0&&showState(s)!=='onhold'&&!nextEp(s.id)&&upcomingEp(s.id))
    .sort((a,b)=>upcomingEp(a.id).air.localeCompare(upcomingEp(b.id).air));
  const active=watchNow;
  const nNew=active.filter(s=>newEp(s.id)).length;
  const recent=Object.values(S.shows).filter(s=>watchedCount(s.id)>0)
    .sort((a,b)=>lastWatch(b.id).localeCompare(lastWatch(a.id))).slice(0,12);
  const eps=Object.values(S.watched).reduce((a,w)=>a+Object.keys(w).length,0);
  const mv=Object.values(S.movies).filter(m=>m.status==='watched').length;
  const favItems=[
    ...Object.values(S.shows).filter(s=>s.favorite).map(s=>posterCard(s)),
    ...Object.values(S.movies).filter(m=>m.favorite).map(m=>movieCard(m))
  ];
  const favs=favItems.slice(0,12);
  const hero=active.slice(0,10).map(s=>{
    const tv=S.tvm[s.id],nx=nextEp(s.id),up=upcomingEp(s.id),nw=newEp(s.id),wc=watchedCount(s.id);
    const tot=tv?.eps?tv.eps.filter(e=>!epFuture(e)).length:0;
    const wl=S.keys.tmdb?watchList('s'+s.id):null,w0=wl?.items[0],wu=w0&&watchUrl(w0.n,s.title,wl.link);
    return `<a class="hcard" href="#/show/${s.id}">
      ${wu?`<button class="hwatch" onclick="event.preventDefault();event.stopPropagation();copyTitle(${jsa(s.title)});window.open(${jsa(wu)},'_blank','noopener')" aria-label="Watch on ${esc(w0.n)}">${w0.l?`<img src="${esc(w0.l)}" alt="">`:''}▶</button>`:''}
      ${tv?.img?`<img loading="lazy" src="${tv.imgBig||tv.img}">`:`<div class="ph">${esc(s.title)}</div>`}
      <div class="ov"><div class="t">${esc(s.title)}</div>
      <div class="nx">${nw?`<span style="color:var(--green);font-weight:700">NEW</span> · S${nw.s} E${nw.e} · aired ${agoDays(nw.air)}`:nx?`next · S${nx.s} E${nx.e}`:(up?`new ep ${fmtDate(up.air)}`:tot?'':'&nbsp;')}</div>
      ${tot?`<div class="bar"><i style="width:${Math.min(100,wc/tot*100)}%"></i></div>`:''}</div></a>`;
  }).join('');
  return `<header class="hdr"><div><div class="hi">Hello,</div><div class="name" onclick="${S.prefs.name?'':"go('gear')"}">${S.prefs.name?esc(S.prefs.name):'there'}</div></div>
    <div class="badge link" onclick="go('stats')" role="button" aria-label="Open stats">${nNew?`<b style="color:var(--green)">${nNew} new</b> · `:''}<b>${eps}</b> eps · <b>${mv}</b> films ›</div></header>
  ${backupDue()?`<div class="nudge"><span>💾 Last backup: <b>${lastBackupTxt()}</b>. Your data lives only on this device.</span>
    <button class="btn gold" onclick="exportJSON()">Back up</button><button class="btn" onclick="snoozeBackup()">Later</button></div>`:''}
  <div class="sec"><h2>Watch next</h2><span class="all" onclick="go('list')">See all</span></div>
  ${hero?`<div class="hero">${hero}</div>`:'<div class="empty"><div class="big">◌</div>Nothing to watch right now.<br>Import data in Settings, or add shows via Search.</div>'}
  ${upcoming.length?`<div class="sec"><h2>Upcoming</h2></div>
  <div class="row-scroll">${upcoming.map(s=>{
    const up=upcomingEp(s.id),tv=S.tvm[s.id];
    return `<a class="pc" href="#/show/${s.id}">
      ${tv?.img?`<img loading="lazy" src="${tv.img}">`:`<div class="ph">${esc(s.title)}</div>`}
      <span class="pill amber tag">${fmtDate(up.air)}</span></a>`}).join('')}</div>`:''}
  <div class="sec"><h2>Recently watched</h2></div>
  <div class="row-scroll">${recent.map(posterCard).join('')||'<div class="empty">—</div>'}</div>
  ${favs.length?`<div class="sec"><h2>Favorites</h2><span class="all" onclick="goFavs()">See all</span></div>
  <div class="row-scroll">${favs.join('')}</div>`:''}`;
}
