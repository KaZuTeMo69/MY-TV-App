/* Watchlog · Startup: load saved data, run migrations, kick off background jobs */
/* ============ boot ============ */
// upgrades data saved by older versions; safe to run on every start
function migrate(){
  const {movieView,showView,...pr}=S.prefs||{};
  S.prefs={listView:'grid',name:'',region:'SA',services:[],...pr};
  // shows added from Search could get an empty placeholder with no TVmaze id and never load
  // episodes; dropping it lets the background matcher try again
  let tvmDirty=false;
  for(const id of Object.keys(S.shows))if(S.tvm[id]&&!S.tvm[id].mid){delete S.tvm[id];tvmDirty=true}
  if(tvmDirty)saveOne('tvm');
  // movie caches used to be keyed by title; move them to per-movie keys. A title shared by two
  // movies can't be split safely, so those are simply fetched again.
  const legacy=Object.keys(S.tmdbMeta).some(k=>k[0]!=='#')||Object.keys(S.tmdbPosters).some(k=>k[0]!=='#');
  if(legacy){
    const cnt={};Object.values(S.movies).forEach(m=>cnt[m.title]=(cnt[m.title]||0)+1);
    const meta={},post={};
    for(const [k,v] of Object.entries(S.tmdbMeta))if(k[0]==='#')meta[k]=v;
    for(const [k,v] of Object.entries(S.tmdbPosters))if(k[0]==='#')post[k]=v;
    Object.values(S.movies).forEach(m=>{
      if(cnt[m.title]!==1)return;
      if(meta[mkey(m)]===undefined&&S.tmdbMeta[m.title]!==undefined){
        const x=S.tmdbMeta[m.title];meta[mkey(m)]=x;
        if(x?.tmdbId&&!m.tmdbId)m.tmdbId=x.tmdbId;
        if(x)delete x.prov; // providers now live in S.prov, per region
      }
      if(post[mkey(m)]===undefined&&S.tmdbPosters[m.title]!==undefined)post[mkey(m)]=S.tmdbPosters[m.title];
    });
    S.tmdbMeta=meta;S.tmdbPosters=post;
    saveOne('tmdbMeta');saveOne('tmdbPosters');saveOne('movies');
  }
}
(async()=>{
  await DB.open();
  for(const k of ['shows','watched','movies','epRatings','movieRatings','tvm','keys','tmdbPosters','prefs','tmdbMeta','prov']){
    const v=await DB.get(k);if(v)S[k]=v;
  }
  migrate();
  S.loaded=Object.keys(S.shows).length>0;
  if(!S.loaded)location.hash='#/gear';
  else if(!['show','movie','preview','person'].includes(route().r))location.hash='#/home';
  await render();
  document.addEventListener('touchstart',()=>{},{passive:true});
  if(S.loaded){backgroundMatch();if(S.keys.tmdb)setTimeout(providerMatch,4000)}
})();
