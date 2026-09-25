/* Watchlog · TV Time zip import, JSON backup import/export, merge vs replace */
/* ============ GDPR zip importer ============ */
async function importZip(file){
  toast('Reading archive…');
  const zip=await JSZip.loadAsync(file);
  const read=async n=>{const f=zip.file(new RegExp(n.replace('.','\\.')+'$'))[0];return f?Papa.parse(await f.async('string'),{header:true,skipEmptyLines:true}).data:[]};
  const uts=await read('user_tv_show_data.csv'), fol=await read('followed_tv_show.csv'),
        spc=await read('user_show_special_status.csv'), v2=await read('tracking-prod-records-v2.csv'),
        v1=await read('tracking-prod-records.csv'), rew=await read('rewatched_episode.csv'),
        er=await read('ratings-3-prod-episode_votes.csv'), mr=await read('ratings-live-votes.csv');
  if(!uts.length&&!v2.length){toast('No TV Time data found in this zip');return}
  const shows={},watched={},movies={};
  const put=(sid,t)=>{shows[sid]=shows[sid]||{id:sid,title:t,followed:false,favorite:false,userStatus:null,addedAt:null,archived:false};return shows[sid]};
  uts.forEach(r=>{if(!r.tv_show_id)return;const s=put(r.tv_show_id.trim(),(r.tv_show_name||'').trim());s.followed=r.is_followed==='1';s.favorite=r.is_favorited==='1'});
  fol.forEach(r=>{const s=shows[(r.tv_show_id||'').trim()];if(s){s.addedAt=r.created_at;s.archived=r.archived==='1'}});
  spc.forEach(r=>{const s=shows[(r.tv_show_id||'').trim()];if(s&&r.status==='for_later')s.userStatus='plan'});
  const n2i={};Object.values(shows).forEach(s=>n2i[s.title]=s.id);
  v2.forEach(r=>{
    const sn=(r.series_name||'').trim();if(!sn||r.season_number===''||r.episode_number==='')return;
    let sid=(r.s_id||'').trim()||n2i[sn];
    if(!sid){sid='x_'+sn.toLowerCase().replace(/\W+/g,'_');put(sid,sn);n2i[sn]=sid}
    const k=epKey(+r.season_number,+r.episode_number);
    watched[sid]=watched[sid]||{};
    const ex=watched[sid][k];
    if(ex){ex.n++;if(r.created_at<ex.d)ex.d=r.created_at}
    else watched[sid][k]={d:r.created_at,n:(r.key||'').startsWith('rewatch')?2:1};
  });
  rew.forEach(r=>{const sid=n2i[(r.tv_show_name||'').trim()];if(!sid)return;const k=epKey(+r.episode_season_number,+r.episode_number);if(watched[sid]?.[k])watched[sid][k].n=Math.max(watched[sid][k].n,(+r.cpt||0)+1)});
  v1.forEach(r=>{
    const mn=(r.movie_name||'').trim();if(!mn)return;
    const id=r.uuid||mn;
    const m=movies[id]=movies[id]||{id,title:mn,status:null,watchDate:null,releaseDate:(r.release_date||'').slice(0,10)||null,runtime:+r.runtime||null,rewatch:0};
    if(r.type==='watch'){m.status='watched';m.watchDate=((r.watch_date||r.created_at)||'').slice(0,10)}
    else if(r.type==='towatch'&&m.status!=='watched')m.status='watchlist';
    else if(r.type==='rewatch_count')m.rewatch=+r.watch_count||0;
    if(+r.runtime>0)m.runtime=+r.runtime;
  });
  Object.keys(movies).forEach(k=>{if(!movies[k].status)delete movies[k]});
  const vv=k=>{const p=(k||'').split('-');const n=+p[p.length-1];return isNaN(n)?null:n};
  const epRatings=er.filter(r=>r.series_name).map(r=>({show:r.series_name,s:+r.season_number,e:+r.episode_number,v:vv(r.vote_key)}));
  const movieRatings={};mr.forEach(r=>{if(r.movie_name)movieRatings[r.movie_name.trim()]=vv(r.vote_key)});
  await applyImport({shows,watched,movies,epRatings,movieRatings},'Imported');
}
// ask before touching an existing library: merge (keep local changes) or replace everything
function importMode(){
  const nS=Object.keys(S.shows).length,nM=Object.keys(S.movies).length;
  if(!nS&&!nM)return'replace';
  if(confirm(`You already have ${nS} shows and ${nM} movies.\n\nOK = Merge: add what's in the file and keep everything you've marked here.\nCancel = other options.`))return'merge';
  if(confirm('Replace your whole library with this file? Anything not in the file will be lost.'))return'replace';
  return null;
}
async function applyImport(inc,verb){
  const mode=importMode();
  if(!mode){toast('Import cancelled');return}
  if(mode==='replace'){
    Object.assign(S,{shows:inc.shows,watched:inc.watched||{},movies:inc.movies||{},
      epRatings:inc.epRatings||[],movieRatings:inc.movieRatings||{}});
    if(inc.tvm)S.tvm=inc.tvm;
    if(inc.prefs)S.prefs={...S.prefs,...inc.prefs};
  }else mergeLib(inc);
  S.loaded=true;
  await save();
  toast(`${verb} ${Object.keys(inc.shows).length} shows · ${Object.keys(inc.movies||{}).length} movies${mode==='merge'?' (merged)':''}`);
  location.hash='#/home';render();backgroundMatch();
}
function mergeLib(inc){
  for(const [id,sh] of Object.entries(inc.shows||{})){
    const ex=S.shows[id];
    if(!ex){S.shows[id]=sh;continue}
    ex.favorite=ex.favorite||sh.favorite;ex.followed=ex.followed||sh.followed;ex.addedAt=ex.addedAt||sh.addedAt;
  }
  for(const [sid,eps] of Object.entries(inc.watched||{})){
    const w=S.watched[sid]=S.watched[sid]||{};
    for(const [k,x] of Object.entries(eps)){
      if(!w[k])w[k]=x;else w[k].n=Math.max(w[k].n||1,x.n||1);
    }
  }
  for(const m of Object.values(inc.movies||{})){
    const t=m.title.toLowerCase(),y=_yr(m.releaseDate);
    const ex=S.movies[m.id]||Object.values(S.movies).find(x=>x.title.toLowerCase()===t&&(!y||!x.releaseDate||_yr(x.releaseDate)===y));
    if(!ex){S.movies[m.id]=m;continue}
    if(ex.status!=='watched'&&m.status==='watched')Object.assign(ex,{status:'watched',watchDate:m.watchDate,rewatch:m.rewatch||0});
    ex.favorite=ex.favorite||m.favorite;
  }
  const seen=new Set(S.epRatings.map(r=>`${r.show}|${r.s}|${r.e}`));
  (inc.epRatings||[]).forEach(r=>{if(!seen.has(`${r.show}|${r.s}|${r.e}`))S.epRatings.push(r)});
  S.movieRatings={...(inc.movieRatings||{}),...S.movieRatings};
  for(const [k,v] of Object.entries(inc.tvm||{}))if(!S.tvm[k])S.tvm[k]=v;
}
async function importJSON(file){
  const j=JSON.parse(await file.text());
  if(!j.shows){toast('Not a valid backup file');return}
  if(Array.isArray(j.shows)){const o={};j.shows.forEach(s=>o[s.id]=s);j.shows=o}
  if(Array.isArray(j.movies)){const o={};j.movies.forEach(m=>o[m.id]=m);j.movies=o}
  await applyImport({shows:j.shows,watched:j.watched||{},movies:j.movies||{},epRatings:j.epRatings||[],
    movieRatings:j.movieRatings||{},tvm:j.tvm,prefs:j.prefs},'Loaded');
}
async function exportJSON(){
  const name=`watchlog-backup-${_today()}.json`;
  const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),
    shows:S.shows,watched:S.watched,movies:S.movies,epRatings:S.epRatings,movieRatings:S.movieRatings,tvm:S.tvm,prefs:S.prefs})],{type:'application/json'});
  // the installed app on iPhone can't download files, so offer the share sheet (Save to Files) there
  const file=typeof File==='function'?new File([blob],name,{type:'application/json'}):null;
  if(isInstalled()&&file&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:'Watchlog backup'})}
    catch(e){if(e.name==='AbortError')return;toast('Could not share the backup');return}
  }else{
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  }
  S.prefs.lastBackup=_today();S.prefs.backupSnooze='';await saveOne('prefs');
  toast('Backup saved');render(false);
}
// Home shows a reminder when the last backup is 14+ days old (or never), unless snoozed
const BACKUP_EVERY=14;
function backupDue(){
  if(!Object.keys(S.shows).length&&!Object.keys(S.movies).length)return false;
  if(S.prefs.backupSnooze&&daysTo(S.prefs.backupSnooze)>0)return false;
  return !S.prefs.lastBackup||-daysTo(S.prefs.lastBackup)>=BACKUP_EVERY;
}
const lastBackupTxt=()=>S.prefs.lastBackup?agoDays(S.prefs.lastBackup):'never';
window.snoozeBackup=async()=>{
  const d=new Date();d.setDate(d.getDate()+3);
  S.prefs.backupSnooze=_ymd(d);await saveOne('prefs');render(false);
};
