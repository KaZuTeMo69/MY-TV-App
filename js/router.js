/* Watchlog · Hash router, render loop and file drop/picker */
/* ============ router ============ */
function route(){
  const h=location.hash.slice(2)||'home';
  const i=h.indexOf('/');
  return i<0?{r:h,arg:''}:{r:h.slice(0,i),arg:h.slice(i+1)};
}
async function render(scroll=true){
  const {r,arg}=route();
  renderNav(r);
  const app=$('#app');
  if(r==='show'){app.innerHTML=await vShow(arg)}
  else if(r==='movie'){app.innerHTML=vMovie(decodeURIComponent(arg||''))}
  else if(r==='preview'){const [t,pid]=arg.split('/');app.innerHTML=vPreview(t,+pid)}
  else if(r==='person'){const [pid,mode]=arg.split('/');app.innerHTML=vPerson(+pid,mode||'')}
  else if(r==='list'||r==='shows'||r==='movies'){app.innerHTML=vList()}
  else if(r==='search'){app.innerHTML=vSearch()}
  else if(r==='gear'){app.innerHTML=vSettings();bindDrop()}
  else if(r==='stats'){app.innerHTML=vStats()}
  else{app.innerHTML=vHome()}
  if(scroll)window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{
  const r=route().r;
  if(r==='show')openSeason=null;
  castOpen=false; if(r==='person')bioOpen=false;
  render();
});

function bindDrop(){
  const dz=$('#dz');if(!dz)return;
  ['dragover','dragenter'].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.add('over')}));
  ['dragleave','drop'].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.remove('over')}));
  dz.addEventListener('drop',ev=>handleFile(ev.dataTransfer.files[0]));
}
$('#filezip').addEventListener('change',e=>handleFile(e.target.files[0]));
function handleFile(f){
  if(!f)return;
  if(f.name.endsWith('.zip'))importZip(f).catch(e=>toast('Import failed: '+e.message));
  else importJSON(f).catch(e=>toast('Import failed: '+e.message));
}
