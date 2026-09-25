/* Watchlog · Installable app: offline support (service worker) and the Settings "Install" section */
const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let _installPrompt=null; // Android/desktop Chrome hands us this when the app can be installed
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();_installPrompt=e;
  if(route().r==='gear')render(false);
});
window.addEventListener('appinstalled',()=>{_installPrompt=null;toast('Watchlog installed ✓')});
window.installApp=async()=>{
  if(!_installPrompt)return;
  _installPrompt.prompt();
  await _installPrompt.userChoice;
  _installPrompt=null;render(false);
};
function installSection(){
  let body;
  if(isInstalled()){
    body=`<p>You're using the installed app ✓</p>
      ${isIOS()?'<p>On iPhone the installed app keeps its own data, separate from Safari. To bring your library over, export a backup in Safari and import it here.</p>':''}`;
  }else if(location.protocol==='file:'){
    body='<p>Open Watchlog from its web address (GitHub Pages) to install it.</p>';
  }else if(_installPrompt){
    body=`<p>Add Watchlog to your home screen. It opens full-screen and works offline.</p>
      <div class="btnrow"><button class="btn gold" onclick="installApp()">Install Watchlog</button></div>`;
  }else if(isIOS()){
    body=`<p>In <b>Safari</b>: tap the Share button (square with an arrow) → <b>Add to Home Screen</b>.</p>
      <p>The installed app keeps its own data, separate from Safari: <b>Export backup</b> here first, then import it in the app.</p>`;
  }else{
    body='<p>In <b>Chrome</b>: open the ⋮ menu → <b>Install app</b> (or <b>Add to Home screen</b>). It opens full-screen and works offline.</p>';
  }
  return `<div class="set"><h3>Install app</h3>${body}</div>`;
}
// ask the browser not to clear this site's storage (your library) when the device runs low on space
if(navigator.storage?.persist)navigator.storage.persisted().then(p=>p||navigator.storage.persist()).catch(()=>{});
// the service worker keeps the app's files so it opens without internet (not available from file://)
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      // hand over everything this page already loaded, so the first visit is cached too
      const urls=[location.href.split('#')[0],...performance.getEntriesByType('resource').map(e=>e.name)];
      (reg.active||navigator.serviceWorker.controller)?.postMessage({cache:urls});
    }catch(e){}
  });
}
