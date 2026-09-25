/* Watchlog · Settings screen */
function vSettings(){
  const nShows=Object.keys(S.shows).length,nMov=Object.keys(S.movies).length;
  const matched=Object.keys(S.shows).filter(id=>S.tvm[id]).length;
  // services to offer: the common ones plus any found in the library for this region
  const found=new Set(COMMON_SERVICES);
  Object.keys(S.prov).forEach(k=>provFor(k)?.p.forEach(x=>found.add(normProv(x.n))));
  myServices().forEach(n=>found.add(n));
  return `<header class="hdr"><div class="name">Settings</div></header>
  <div class="set"><h3>Profile</h3>
    <p>Your name, shown on the Home screen.</p>
    <input placeholder="Your name" value="${esc(S.prefs.name||'')}" onchange="setName(this.value)">
  </div>
  <div class="set"><h3>Streaming & region</h3>
    <p>Where you watch. "Where to watch" buttons and the Screen filter use this region.</p>
    <div class="chips">${REGIONS.map(([c,n,f])=>`<button class="chip ${region()===c?'on':''}" onclick="setRegion('${c}')">${f} ${n}</button>`).join('')}</div>
    <p style="margin-top:14px">My services — these are listed first on every title.</p>
    <div class="svc">${[...found].filter(Boolean).sort().map(n=>`<button class="chip ${myServices().includes(n)?'on':''}" onclick="tgService(${jsa(n)})">${myServices().includes(n)?'✓ ':''}${esc(n)}</button>`).join('')}</div>
    ${S.keys.tmdb?'':'<p style="margin-top:12px">Needs a TMDB key (below) to look up streaming services.</p>'}
  </div>
  ${watchLinksSection([...found].filter(Boolean))}
  <div class="set"><h3>Library & backup</h3>
    <p>${nShows} shows · ${nMov} movies · artwork matched ${matched}/${nShows}<br>Last backup: ${lastBackupTxt()}</p>
    <div class="btnrow">
      <button class="btn gold" onclick="pickFile()">Import TV Time zip / backup JSON</button>
      <button class="btn" onclick="exportJSON()">Export backup</button>
      <button class="btn" onclick="go('stats')">View stats</button>
      ${matching?'<button class="btn" disabled>Matching…</button>':'<button class="btn" onclick="backgroundMatch(true)">Re-run matching</button>'}
    </div>
    <div class="dropzone" id="dz" style="margin-top:12px">…or drop your <b>gdpr-data.zip</b> / backup file here</div>
  </div>
  ${installSection()}
  <div class="set"><h3>API keys</h3>
    <p><b>TMDB</b> — posters, discovery and streaming services. Free at themoviedb.org → Settings → API. Paste the "API Key (v3 auth)".</p>
    <input placeholder="TMDB API key" value="${esc(S.keys.tmdb)}" onchange="setKey('tmdb',this.value)">
    <p style="margin-top:14px"><b>OMDb</b> — IMDb / Rotten Tomatoes scores. Free at omdbapi.com. Used in an upcoming version.</p>
    <input placeholder="OMDb API key" value="${esc(S.keys.omdb)}" onchange="setKey('omdb',this.value)">
  </div>
  <div class="set"><h3>App version</h3>
    <p>Watchlog <b>${window.APP_VERSION}</b>. New versions are checked automatically when the app opens; on Home you can also pull down to refresh.</p>
    <div class="btnrow"><button class="btn" onclick="manualUpdateCheck(this)">Check for updates</button></div>
  </div>
  <div class="set"><h3>Danger zone</h3>
    <div class="btnrow"><button class="btn danger" onclick="wipe()">Erase everything</button></div>
  </div>
  <p style="font-size:11px;color:var(--tx3);text-align:center;padding:8px 0 20px">Watchlog ${window.APP_VERSION} · your data lives only on this device · back up often</p>`;
}
window.setKey=async(k,v)=>{S.keys[k]=v.trim();await saveOne('keys');if(k==='tmdb'&&v.trim()){toast('Fetching movie data…');providerMatch()}};
window.setName=async v=>{S.prefs.name=v.trim().slice(0,30);await saveOne('prefs');toast('Saved')};
window.setRegion=async c=>{S.prefs.region=c;await saveOne('prefs');render(false)};
window.tgService=async n=>{
  const l=myServices();
  S.prefs.services=l.includes(n)?l.filter(x=>x!==n):[...l,n];
  await saveOne('prefs');render(false);
};
window.pickFile=()=>$('#filezip').click();
window.wipe=async()=>{
  if(!confirm('Erase all local data? Export a backup first if unsure.'))return;
  // an open connection would block the delete, so close ours and wait for it to finish
  try{DB.db.close()}catch(e){}
  await new Promise(res=>{const r=indexedDB.deleteDatabase('watchlog');r.onsuccess=r.onerror=r.onblocked=res});
  location.reload();
};
// per-service choice of link, with a Test button to try it on this phone
function watchLinksSection(services){
  const mine=myServices(),list=[...new Set([...mine,...services])].filter(Boolean)
    .sort((x,y)=>mine.includes(y)-mine.includes(x)||x.localeCompare(y));
  if(!list.length)return'';
  return `<div class="set"><h3>Watch links</h3>
    <p>Choose what each "Where to watch" button opens. Tap <b>Test</b> to check it opens the app on this phone; if it opens a web page instead, try another option.</p>
    ${list.map(n=>{const cur=watchPick(n),test=cur[0]==='tmdb'?'https://www.themoviedb.org/tv/1396/watch':(cur[2](encodeURIComponent('Breaking Bad')));
      return `<div class="lnk"><span>${esc(n)}</span>
        <select onchange="setLinkPick(${jsa(n)},this.value)">${watchOpts(n).map(o=>`<option value="${o[0]}" ${o[0]===cur[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select>
        <a class="btn" href="${esc(test)}" target="_blank" rel="noopener" onclick="copyTitle('Breaking Bad')">Test</a></div>`}).join('')}
  </div>`;
}
