/* Watchlog service worker: lets the installed app open without internet.
   Bump VERSION on every release (same number as APP_VERSION / ?v= in index.html). */
const VERSION='3.0';
const SHELL='watchlog-shell';   // the app's own files + the CDN libraries and font
const IMG='watchlog-img';       // posters and stills, capped at IMG_MAX entries
const IMG_MAX=400;
const IMG_HOSTS=['image.tmdb.org','static.tvmaze.com'];
const CDN_HOSTS=['cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  // drop the previous release's files (their ?v= no longer matches)
  const c=await caches.open(SHELL);
  for(const req of await c.keys()){
    const v=new URL(req.url).searchParams.get('v');
    if(v&&v!==VERSION)await c.delete(req);
  }
  await self.clients.claim();
})()));

// the page sends the URLs it loaded before this worker was in control
self.addEventListener('message',e=>{
  const urls=(e.data&&e.data.cache)||[];
  e.waitUntil((async()=>{
    const c=await caches.open(SHELL);
    for(const u of urls){
      const url=new URL(u);
      if(url.origin!==location.origin&&!CDN_HOSTS.includes(url.hostname))continue;
      if(await c.match(u))continue;
      try{const r=await fetch(u,{mode:url.origin===location.origin?'same-origin':'cors',credentials:'omit'});if(r.ok)await c.put(u,r)}catch(err){}
    }
  })());
});

async function trimImages(){
  const c=await caches.open(IMG),keys=await c.keys();
  for(let i=0;i<keys.length-IMG_MAX;i++)await c.delete(keys[i]);
}
// Cross-site files are fetched in CORS mode so the cache stores a real response. Opaque
// (no-cors) responses are never cached: browsers count each as several MB of storage, which
// could push the site over quota and risk the library in IndexedDB.
async function cacheFirst(req,name){
  const c=await caches.open(name);
  const hit=await c.match(req.url);
  if(hit)return hit;
  const url=new URL(req.url);
  let r;
  if(url.origin===location.origin)r=await fetch(req);
  else{
    try{r=await fetch(req.url,{mode:'cors',credentials:'omit'})}
    catch(err){return fetch(req)} // host without CORS: pass through, uncached
  }
  if(r.ok){await c.put(req.url,r.clone());if(name===IMG)trimImages()}
  return r;
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // the page itself: always try the network first so updates arrive, fall back offline
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(SHELL);
      try{const r=await fetch(req);c.put(url.origin+url.pathname,r.clone());return r}
      catch(err){return (await c.match(url.origin+url.pathname))||(await c.match(new URL('./',location).href))||Response.error()}
    })());
    return;
  }
  if(url.origin===location.origin||CDN_HOSTS.includes(url.hostname))e.respondWith(cacheFirst(req,SHELL));
  else if(IMG_HOSTS.includes(url.hostname))e.respondWith(cacheFirst(req,IMG).catch(()=>Response.error()));
  // TVmaze/TMDB API calls are left alone: the app keeps its own data in IndexedDB
});
