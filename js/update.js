/* Watchlog · App updates: "Update available" banner, Settings "Check for updates", pull-to-refresh on Home */
let _newVersion=null,_lastCheck=0;
const verNum=v=>String(v||'').replace(/^v/,'').split('.').map(n=>+n||0);
function isNewer(a,b){ // is version a newer than b?
  const x=verNum(a),y=verNum(b);
  for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)}
  return false;
}
// reads APP_VERSION from the index.html currently on GitHub Pages; true when it's newer than this copy
async function checkForUpdate(){
  if(!location.protocol.startsWith('http'))return false;
  _lastCheck=Date.now();
  try{
    // no-store + a unique query: skip the phone's cache, the offline worker and GitHub's CDN copy
    const r=await fetch(`index.html?check=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)return false;
    const v=(/APP_VERSION='(v[\d.]+)'/.exec(await r.text())||[])[1];
    if(v&&isNewer(v,window.APP_VERSION)){_newVersion=v;showUpdateBar();return true}
  }catch(e){}
  return false;
}
function showUpdateBar(){
  let el=$('#updbar');
  if(!el){el=document.createElement('div');el.id='updbar';el.className='updbar';document.body.appendChild(el)}
  el.innerHTML=`<span>New version <b>${esc(_newVersion)}</b> is available</span>
    <button class="btn gold" onclick="applyUpdate()">Update</button>
    <button class="btn" onclick="this.parentElement.remove()" aria-label="Dismiss">✕</button>`;
}
// fetch the new service worker too, then reload: the page itself always comes from the network first
window.applyUpdate=async()=>{
  toast('Updating…');
  try{const reg=await navigator.serviceWorker?.getRegistration();await reg?.update()}catch(e){}
  location.reload();
};
window.manualUpdateCheck=async btn=>{
  if(btn){btn.disabled=true;btn.textContent='Checking…'}
  const found=await checkForUpdate();
  if(btn){btn.disabled=false;btn.textContent='Check for updates'}
  if(!found)toast(location.protocol.startsWith('http')?`You're on the latest version (${window.APP_VERSION})`:'Updates are checked on the web version');
};
// check on start and whenever the app comes back to the foreground (at most every 30 minutes);
// on iPhone the installed app is usually resumed rather than restarted, so resume matters most
window.addEventListener('load',()=>setTimeout(checkForUpdate,3000));
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-_lastCheck>30*60e3)checkForUpdate();
});

/* ---- pull down on Home to refresh ---- */
const PTR_TRIGGER=70; // px of pull (after damping) that triggers a refresh
let _ptrY=null,_ptrD=0,_ptrBusy=false;
function ptrEl(){
  let el=$('#ptr');
  if(!el){el=document.createElement('div');el.id='ptr';el.className='ptr';el.innerHTML='<span>↻</span>';document.body.appendChild(el)}
  return el;
}
function ptrShow(d,spin){
  const el=ptrEl();
  el.style.transform=`translate(-50%,${Math.min(d,90)-50}px) rotate(${spin?0:d*3}deg)`;
  el.style.opacity=Math.min(1,d/PTR_TRIGGER);
  el.classList.toggle('spin',!!spin);
  el.classList.toggle('ready',d>=PTR_TRIGGER);
}
document.addEventListener('touchstart',e=>{
  _ptrY=(!_ptrBusy&&route().r==='home'&&window.scrollY<=0&&e.touches.length===1)?e.touches[0].clientY:null;_ptrD=0;
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(_ptrY===null)return;
  const dy=e.touches[0].clientY-_ptrY;
  if(dy<=0||window.scrollY>0){_ptrD=0;ptrShow(0);return}
  _ptrD=dy*.5;ptrShow(_ptrD);
},{passive:true});
document.addEventListener('touchend',()=>{
  if(_ptrY===null)return;
  _ptrY=null;
  if(_ptrD>=PTR_TRIGGER)pullRefresh();else ptrShow(0);
});
// a new version wins (reload); otherwise re-fetch episode lists for the shows on Home
async function pullRefresh(){
  _ptrBusy=true;ptrShow(PTR_TRIGGER,true);
  try{
    if(await checkForUpdate()){applyUpdate();return}
    const ids=Object.values(S.shows).filter(s=>watchedCount(s.id)>0&&['watching','uptodate'].includes(showState(s))&&S.tvm[s.id]).map(s=>s.id);
    let fresh=0;
    for(const id of ids){if(await ensureEpisodes(id,true))fresh++;await new Promise(r=>setTimeout(r,250))}
    render(false);
    toast(ids.length?`Refreshed ${fresh} show${fresh===1?'':'s'} · ${window.APP_VERSION} is the latest`:`${window.APP_VERSION} is the latest`);
  }finally{_ptrBusy=false;ptrShow(0)}
}
