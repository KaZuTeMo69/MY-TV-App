/* Watchlog · "Where to watch" links, My services and the region switch */
/* ---- "Watch on …" links ---- */
// Link choices per service, first one is the default. On a phone, a web link opens the installed
// app only if that service registered the address with iOS/Android, which can't be checked from
// here, so Settings → Watch links lets you pick whichever option opens the app on your phone.
// 'home' links open the service's site/app and copy the title so it can be pasted into search.
const WATCH_OPTS={
  'Netflix':[['search','Search in the app',q=>`https://www.netflix.com/search?q=${q}`]],
  'Prime Video':[['app','Search via app.primevideo.com',q=>`https://app.primevideo.com/search?phrase=${q}`],
    ['web','Search via www.primevideo.com',q=>`https://www.primevideo.com/search?phrase=${q}`],
    ['home','Open Prime Video (title copied)',()=>'https://app.primevideo.com/']],
  'Apple TV+':[['search','Search in the app',q=>`https://tv.apple.com/search?term=${q}`]],
  'Disney+':[['search','Search in the app',q=>`https://www.disneyplus.com/search?q=${q}`]],
  'YouTube':[['search','Search in the app',q=>`https://www.youtube.com/results?search_query=${q}`]],
  'Crunchyroll':[['search','Search in the app',q=>`https://www.crunchyroll.com/search?q=${q}`]],
  'Shahid':[['home','Open Shahid (title copied)',()=>'https://shahid.mbc.net/']],
  'OSN+':[['home','Open OSN+ (title copied)',()=>'https://osnplus.com/']],
  'STARZPLAY':[['home','Open STARZPLAY (title copied)',()=>'https://starzplay.com/']],
  'Watch It':[['home','Open Watch It (title copied)',()=>'https://www.watchit.com/']]
};
const TMDB_OPT=['tmdb','TMDB where-to-watch page',null];
const watchOpts=n=>[...(WATCH_OPTS[n]||[]),TMDB_OPT];
const watchPick=n=>{const o=watchOpts(n),k=(S.prefs.linkPick||{})[n];return o.find(x=>x[0]===k)||o[0]};
window.setLinkPick=async(n,k)=>{S.prefs.linkPick={...(S.prefs.linkPick||{}),[n]:k};await saveOne('prefs');render(false)};
// every watch tap also copies the title, for services where you land on the app's home screen
window.copyTitle=t=>{try{navigator.clipboard?.writeText(t)}catch(e){}};
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
function watchUrl(n,title,link){
  const o=watchPick(n);
  return o[0]==='tmdb'?(link||''):o[2](encodeURIComponent(title));
}
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
        return u?`<a class="wbtn ${x.mine?'mine':''}" href="${esc(u)}" target="_blank" rel="noopener" onclick="copyTitle(${jsa(title)})">${x.l?`<img src="${esc(x.l)}" alt="">`:''}▶ ${esc(x.n)}</a>`:''}).join('')}</div>`
      +(wl.items.some(x=>watchPick(x.n)[0]==='home')?'<p class="wnote" style="margin-top:8px">Tapping a service copies the title — paste it into the app\'s search.</p>':'');
  }
  return `<div class="sec" style="margin-top:18px"><h2>Where to watch</h2>
    <button class="rgn" onclick="cycleRegion()" aria-label="Change region">${flag} ${code} ▾</button></div>${body}`;
}
window.cycleRegion=async()=>{
  const i=REGIONS.findIndex(r=>r[0]===region());
  S.prefs.region=REGIONS[(i+1)%REGIONS.length][0];
  await saveOne('prefs');toast(`Region: ${regionInfo()[1]}`);render(false);
};
