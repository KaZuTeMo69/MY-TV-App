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

/* ---- pull down on Home to refresh ----
   The page (#app) follows the finger and the spinner sits in the gap revealed above it, like a
   native list. iOS's own rubber-band bounce is blocked while pulling so the two don't fight. */
const PTR_TRIGGER=70;  // px the page must move (after damping) to trigger a refresh
const PTR_HOLD=56;     // px the page stays down while refreshing
const PTR_MIN_SPIN=700;// ms the spinner stays visible, so a fast refresh is still noticeable
let _ptrY=null,_ptrD=0,_ptrBusy=false;
function ptrEl(){
  let el=$('#ptr');
  if(!el){
    el=document.createElement('div');el.id='ptr';el.className='ptr';
    el.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';
    document.body.appendChild(el);
  }
  return el;
}
// d = how far the page is pulled; animate = ease into place (release/finish) instead of tracking the finger
function ptrShow(d,{spin=false,animate=false}={}){
  const el=ptrEl(),app=$('#app');
  const ease=animate?'transform .28s cubic-bezier(.3,.7,.4,1), opacity .2s':'none';
  el.style.transition=ease;app.style.transition=ease;
  app.style.transform=d?`translateY(${d}px)`:'';
  // spinner centred in the revealed gap; its arrow turns with the pull until it's ready
  el.style.transform=`translate(-50%,${d?Math.max(d/2-20,-44):-44}px) rotate(${spin?0:Math.min(d/PTR_TRIGGER,1)*270}deg)`;
  el.style.opacity=d?Math.min(1,d/40):0;
  el.classList.toggle('spin',spin);
  el.classList.toggle('ready',d>=PTR_TRIGGER);
}
document.addEventListener('touchstart',e=>{
  _ptrY=(!_ptrBusy&&route().r==='home'&&window.scrollY<=0&&e.touches.length===1)?e.touches[0].clientY:null;_ptrD=0;
},{passive:true});
// not passive: preventDefault stops iOS bouncing the page while we move it ourselves
document.addEventListener('touchmove',e=>{
  if(_ptrY===null)return;
  const dy=e.touches[0].clientY-_ptrY;
  if(dy<=0||window.scrollY>0){if(_ptrD)ptrShow(0);_ptrD=0;return}
  if(e.cancelable)e.preventDefault();
  _ptrD=Math.min(dy*.5,120);ptrShow(_ptrD);
},{passive:false});
const ptrEnd=()=>{
  if(_ptrY===null)return;
  _ptrY=null;
  if(_ptrD>=PTR_TRIGGER)pullRefresh();else if(_ptrD)ptrShow(0,{animate:true});
  _ptrD=0;
};
document.addEventListener('touchend',ptrEnd);
document.addEventListener('touchcancel',ptrEnd);
// a new version wins (reload); otherwise re-fetch episode lists for the shows on Home
async function pullRefresh(){
  _ptrBusy=true;ptrShow(PTR_HOLD,{spin:true,animate:true});
  const t0=Date.now();
  let msg='';
  try{
    if(await checkForUpdate()){applyUpdate();return}
    const ids=Object.values(S.shows).filter(s=>watchedCount(s.id)>0&&['watching','uptodate'].includes(showState(s))&&S.tvm[s.id]).map(s=>s.id);
    let fresh=0;
    for(const id of ids){if(await ensureEpisodes(id,true))fresh++;await new Promise(r=>setTimeout(r,250))}
    msg=ids.length?`Refreshed ${fresh} show${fresh===1?'':'s'} · ${window.APP_VERSION} is the latest`:`${window.APP_VERSION} is the latest`;
  }finally{
    await new Promise(r=>setTimeout(r,Math.max(0,PTR_MIN_SPIN-(Date.now()-t0))));
    ptrShow(0,{animate:true});
    // re-render once the page has eased back, so the content doesn't jump mid-animation
    setTimeout(()=>{_ptrBusy=false;if(msg){render(false);toast(msg)}},300);
  }
}
