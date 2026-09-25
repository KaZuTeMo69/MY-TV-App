/* Watchlog · Show page and episode/season actions */
let openSeason=null;
async function vShow(id){
  const sh=S.shows[id];
  if(!sh)return'<div class="empty">Show not found.</div>';
  const tv=S.tvm[id];
  if(tv){ensureEpisodes(id).then(fresh=>fresh&&render(false))}
  if(tv&&tv.trailer===undefined&&S.keys.tmdb){tvTrailer(id)}
  if(tv&&tv.castv!==2&&!_castTried.has(id)){_castTried.add(id);showCast(id)}
  const rmap=epRatingMap(id);
  const w=S.watched[id]||{},wc=Object.keys(w).length;
  const eps=tv?.eps||[],aired=eps.filter(e=>!epFuture(e)),tot=aired.length;
  const nx=nextEp(id);
  const seasons={};eps.forEach(e=>{(seasons[e.s]=seasons[e.s]||[]).push(e)});
  if(openSeason===null){openSeason=nx?nx.s:(aired.length?aired[aired.length-1].s:null)}
  const up=upcomingEp(id);
  const nw=newEp(id);
  const chips=[
    nw?`<span class="pill green">NEW · S${nw.s} E${nw.e} · aired ${agoDays(nw.air)}</span>`:'',
    up?`<span class="pill amber">next: S${up.s} E${up.e} · ${fmtDate(up.air)}</span>`:'',
    tv?.rating?`<span class="pill gold">★ ${tv.rating}</span>`:'',
    tv?.status?`<span class="pill ${tv.status==='Ended'?'red':tv.status==='Running'?'green':''}">${tv.status}${tv.premiered?` · ${tv.premiered}`:''}</span>`:'',
    tv?.network?`<span class="pill">${esc(tv.network)}</span>`:'',
    ...(tv?.genres||[]).map(g=>`<span class="pill">${esc(g)}</span>`)
  ].join('');
  return `<div class="dt-hero">
    ${tv?.imgBig?`<img src="${tv.imgBig}">`:`<div style="height:100%;background:var(--card2)"></div>`}
    <div class="fade"></div>
    <div class="top"><button class="iconbtn" onclick="history.back()">‹</button>
    <button class="iconbtn" onclick="toggleFav('${id}')">${sh.favorite?'★':'☆'}</button></div>
    <div class="dt-title"><h1>${esc(sh.title)}</h1><div class="meta">${chips}</div></div>
  </div>
  <div class="dt-body">
    ${tot?`<div class="progress"><span>${wc}/${tot} eps</span><div class="bar"><i style="width:${Math.min(100,wc/tot*100)}%"></i></div><span>${Math.round(wc/tot*100)}%</span></div>`:''}
    ${nx?`<button class="cta" onclick="markNext('${id}')">Mark S${nx.s} E${nx.e} watched${nx.name?` · ${esc(nx.name).slice(0,26)}`:''}</button>`
      :tv&&!tv.eps?'<button class="cta" disabled>Loading episodes…</button>'
      :tot&&wc>=tot?`<button class="cta sub" disabled>All caught up ✓</button>`:''}
    ${tv?.trailer?`<a class="cta sub" style="margin-top:10px" href="https://www.youtube.com/watch?v=${tv.trailer}" target="_blank" rel="noopener">▶ Watch trailer</a>`:''}
    ${tv?watchBlock('s'+id,sh.title):''}
    <div style="height:18px"></div>
    ${Object.keys(seasons).sort((a,b)=>a-b).map(sn=>{
      const se=seasons[sn],seen=se.filter(e=>w[epKey(e.s,e.e)]).length;
      const open=+sn===+openSeason;
      return `<div class="season"><button class="sh" style="width:100%" onclick="tgSeason(${sn})">
        <span>Season ${sn}</span><span class="cnt">${seen}/${se.length} ${open?'▾':'▸'}</span></button>
        ${open?`<div class="eps">${(()=>{
          const av=se.filter(e=>!epFuture(e)),left=av.filter(e=>!w[epKey(e.s,e.e)]).length;
          if(!av.length)return'';
          return left?`<button class="smark" onclick="markSeason('${id}',${sn},true)">✓ Mark ${left===av.length?'season':`${left} remaining`} watched</button>`
            :`<button class="smark" onclick="markSeason('${id}',${sn},false)">Unmark season</button>`})()}${se.map(e=>{
          const k=epKey(e.s,e.e),ww=w[k];
          const efut=epFuture(e);
          return `<div class="ep ${ww?'seen':''}" ${efut?'':`onclick="tgEp('${id}',${e.s},${e.e})"`}>
            <div class="th">${e.img?`<img loading="lazy" src="${e.img}" onerror="thFail(this)">`
              :tv?.img?`<div class="th-fb" style="--fb:url('${tv.img}')"><img loading="lazy" src="${tv.img}" onerror="thFail(this)"></div>`
              :'<div class=\'th-ph\'>▭</div>'}</div>
            <span class="num">E${e.e}</span><span class="nm">${esc(e.name)||''}</span>
            ${ww&&ww.n>1?`<span class="rw">×${ww.n}</span>`:''}
            ${ww?`<button class="erate ${rmap[k]!=null?'on':''}" onclick="event.stopPropagation();rateEp('${id}',${e.s},${e.e})" aria-label="Rate episode">${rmap[k]!=null?starTxt(rmap[k]):'☆'}</button>`:''}
            ${efut?`<span class="epdate">${fmtDate(e.air)}</span>`:'<span class="check">✓</span>'}</div>`}).join('')}</div>`:''}
      </div>`}).join('')||(tv?'<div class="empty">Episode list loading…</div>':'<div class="empty">No online match yet for this title.<br>Artwork and episodes appear once matching finishes.</div>')}
    ${tv?.summary?`<div class="set" style="margin-top:14px"><h3>About</h3><p>${esc(tv.summary)}…</p></div>`:''}
    ${castRow(tv?.cast)}
    <button class="btn" style="width:100%;margin-top:16px" onclick="tgLater('${id}')">${showState(sh)==='onhold'?'▶ Resume watching':'⏸ Watch later'}</button>
    <button class="btn danger" style="width:100%;margin-top:10px" onclick="rmShow('${id}')">Remove from library</button>
  </div>`;
}
window.thFail=el=>{const th=el.closest('.th');if(th)th.innerHTML='<div class="th-ph">▭</div>'};
window.tgSeason=sn=>{openSeason=openSeason===sn?-1:sn;render(false)};
// aired, unwatched episodes before S<s>E<e> (specials in season 0 are left alone)
function earlierUnseen(id,s,e){
  const w=S.watched[id]||{};
  return (S.tvm[id]?.eps||[]).filter(x=>x.s>0&&!epFuture(x)&&!w[epKey(x.s,x.e)]&&(x.s<s||(x.s===s&&x.e<e)));
}
async function markEps(id,list){
  S.watched[id]=S.watched[id]||{};
  const d=_stamp();
  list.forEach(x=>{S.watched[id][epKey(x.s,x.e)]={d,n:1}});
  await resumeIfLater(id);
  await saveOne('watched');render(false);
}
async function resumeIfLater(id){
  const sh=S.shows[id];
  if(sh&&showState(sh)==='onhold'){sh.userStatus=null;sh.archived=false;await saveOne('shows');return true}
  return false;
}
window.tgEp=async(id,s,e)=>{
  const k=epKey(s,e);S.watched[id]=S.watched[id]||{};
  if(S.watched[id][k]){delete S.watched[id][k];await saveOne('watched');render(false);return}
  S.watched[id][k]={d:_stamp(),n:1};
  const resumed=await resumeIfLater(id);
  await saveOne('watched');render(false);
  const before=s>0?earlierUnseen(id,s,e):[];
  if(before.length)toastAct(`S${s} E${e} ✓`,`Also mark ${before.length} earlier`,()=>markEps(id,before).then(()=>toast(`Marked ${before.length} earlier ✓`)));
  else if(resumed)toast('Resumed watching');
};
window.markSeason=async(id,sn,on)=>{
  const se=(S.tvm[id]?.eps||[]).filter(x=>x.s===+sn&&!epFuture(x));
  if(on){await markEps(id,se.filter(x=>!(S.watched[id]||{})[epKey(x.s,x.e)]));toast(`Season ${sn} ✓`);return}
  if(!confirm(`Unmark all ${se.length} episodes of season ${sn}?`))return;
  se.forEach(x=>{delete (S.watched[id]||{})[epKey(x.s,x.e)]});
  await saveOne('watched');render(false);
};
window.markNext=async id=>{
  const nx=nextEp(id);if(!nx)return;
  S.watched[id]=S.watched[id]||{};
  S.watched[id][epKey(nx.s,nx.e)]={d:_stamp(),n:1};
  await saveOne('watched');toast(`S${nx.s} E${nx.e} ✓`);render(false);
};
window.toggleFav=async id=>{S.shows[id].favorite=!S.shows[id].favorite;await saveOne('shows');render(false)};
window.tgLater=async id=>{
  const sh=S.shows[id];if(!sh)return;
  if(showState(sh)==='onhold'){sh.userStatus=null;sh.archived=false;toast('Back to watching')}
  else{sh.userStatus='later';toast('Moved to watch later')}
  await saveOne('shows');render(false);
};
window.rmShow=async id=>{
  const sh=S.shows[id];if(!sh)return;
  const wc=watchedCount(id);
  if(!confirm(`Remove "${sh.title}"${wc?` and its ${wc} watched episodes`:''} from your library? This cannot be undone (except via backup).`))return;
  delete S.shows[id];delete S.watched[id];delete S.tvm[id];
  delete S.tvm['miss_'+id];delete S.prov['s'+id];
  S.epRatings=S.epRatings.filter(r=>r.show!==sh.title);
  await save();toast('Removed');go('list');
};
window.rateEp=(id,s,e)=>{
  const sh=S.shows[id];if(!sh)return;
  const cur=epRatingMap(id)[epKey(s,e)]??null;
  openRate(`S${s} E${e}`,cur,async v=>{
    S.epRatings=S.epRatings.filter(r=>!(r.show===sh.title&&r.s===s&&r.e===e));
    if(v!=null)S.epRatings.push({show:sh.title,s,e,v});
    await saveOne('epRatings');render(false);
  });
};
