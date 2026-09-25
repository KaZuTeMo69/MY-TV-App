/* Watchlog · "Where to watch" links, My services and the region switch */
/* ---- "Watch on …" links ---- */
// services whose web search URL format is known; the rest open TMDB's where-to-watch page
// for the region, which links through to the title on each service
const WATCH_SEARCH={
  'Netflix':q=>`https://www.netflix.com/search?q=${q}`,
  'Prime Video':q=>`https://www.primevideo.com/search?phrase=${q}`,
  'Apple TV+':q=>`https://tv.apple.com/search?term=${q}`,
  'Disney+':q=>`https://www.disneyplus.com/search?q=${q}`,
  'YouTube':q=>`https://www.youtube.com/results?search_query=${q}`,
  'Crunchyroll':q=>`https://www.crunchyroll.com/search?q=${q}`
};
const COMMON_SERVICES=['Netflix','Shahid','OSN+','STARZPLAY','Watch It','Prime Video','Apple TV+','Disney+','Yango Play'];
const myServices=()=>S.prefs.services||[];
// providers for a library key in the current region, normalized, the user's own services first
function watchList(key){
  const pr=provFor(key);if(!pr)return null;
  const seen={},out=[];
  pr.p.forEach(x=>{const n=normProv(x.n);if(n&&!seen[n]){seen[n]=1;out.push({n,l:x.l,mine:myServices().includes(n)})}});
  out.sort((a,b)=>b.mine-a.mine);
  return {link:pr.link,items:out};
}
const watchUrl=(n,title,link)=>WATCH_SEARCH[n]?WATCH_SEARCH[n](encodeURIComponent(title)):(link||'');
const _provTried=new Set();
async function ensureProv(key){
  if(!S.keys.tmdb||_provTried.has(key)||provFor(key)!==null)return;
  _provTried.add(key);
  try{
    let path='';
    if(key[0]==='s'){
      const tid=await showTmdbId(key.slice(1));
      if(tid===null)return;
      if(tid)path=`/tv/${tid}/watch/providers`;else S.prov[key]={v:2,r:{}};
    }else{
      const m=S.movies[key.slice(1)],tid=m&&movieTmdbId(m);
      if(!tid)return;
      path=`/movie/${tid}/watch/providers`;
    }
    if(path)S.prov[key]=provPick(await tmdbFetch(path));
    await saveOne('prov');await saveOne('tvm');render(false);
  }catch(e){}
}
function watchBlock(key,title){
  if(!S.keys.tmdb)return'';
  ensureProv(key);
  const [code,name,flag]=regionInfo();
  const wl=watchList(key);
  let body;
  if(!wl)body='<p class="wnote">Checking streaming services…</p>';
  else if(!wl.items.length)body=`<p class="wnote">Not listed on any streaming service in ${name}.</p>`;
  else{
    const anyMine=wl.items.some(x=>x.mine);
    body=(myServices().length&&!anyMine?`<p class="wnote">Not on your services in ${name}. Also on:</p>`:'')
      +`<div class="wrow">${wl.items.map(x=>{const u=watchUrl(x.n,title,wl.link);
        return u?`<a class="wbtn ${x.mine?'mine':''}" href="${esc(u)}" target="_blank" rel="noopener">${x.l?`<img src="${esc(x.l)}" alt="">`:''}▶ ${esc(x.n)}</a>`:''}).join('')}</div>`;
  }
  return `<div class="sec" style="margin-top:18px"><h2>Where to watch</h2>
    <button class="rgn" onclick="cycleRegion()" aria-label="Change region">${flag} ${code} ▾</button></div>${body}`;
}
window.cycleRegion=async()=>{
  const i=REGIONS.findIndex(r=>r[0]===region());
  S.prefs.region=REGIONS[(i+1)%REGIONS.length][0];
  await saveOne('prefs');toast(`Region: ${regionInfo()[1]}`);render(false);
};
