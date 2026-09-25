/* Watchlog · Library lookups by TMDB id and adding titles from Search / previews */
/* ---- is this TMDB title already in the library? (by id; title+year only when no id is known) ---- */
const _yr=ds=>String(ds||'').slice(0,4);
function findLibMovie(tmdbId,title,year){
  const t=(title||'').toLowerCase();
  return Object.values(S.movies).find(m=>{
    const mid=movieTmdbId(m);
    if(mid)return mid===+tmdbId;
    if(m.title.toLowerCase()!==t)return false;
    const my=_yr(m.releaseDate);
    return !year||!my||my===year;
  })||null;
}
function findLibShow(tmdbId,title,year){
  const t=(title||'').toLowerCase();
  return Object.values(S.shows).find(s=>{
    const tv=S.tvm[s.id];
    if(tv?.tmdbv===2&&tv.tmdbId)return tv.tmdbId===+tmdbId;
    if(s.title.toLowerCase()!==t)return false;
    const sy=tv?.premiered||'';
    return !year||!sy||sy===year;
  })||null;
}
// a search/suggestion row (TMDB or TVmaze shape) -> library item or null
function libMatch(x){
  if(x._src==='tvm')return findLibShow(0,x.name,_yr(x.premiered));
  return x.media_type==='tv'||x._type==='tv'?findLibShow(x.id,x.name,_yr(x.first_air_date))
    :findLibMovie(x.id,x.title,_yr(x.release_date));
}

async function quickAddMovie(title,rel,tmdbId){
  const ex=findLibMovie(tmdbId,title,_yr(rel));
  if(ex){location.hash='#/movie/'+encodeURIComponent(ex.id);return}
  const id='tmdb_'+tmdbId;
  S.movies[id]={id,title,tmdbId:+tmdbId,status:'watchlist',watchDate:null,releaseDate:(rel||'').slice(0,10)||null,runtime:null,rewatch:0};
  await saveOne('movies');toast(`${title} → watchlist`);
  if(S.keys.tmdb)tmdbMovieMeta(S.movies[id]);
  if(route().r==='preview')location.hash='#/movie/'+encodeURIComponent(id);
}
async function quickAddTv(name,tmdbId,firstAir){
  const ex=findLibShow(tmdbId,name,_yr(firstAir));
  if(ex){location.hash='#/show/'+ex.id;return}
  let tvdb=0,mid=0;
  try{const j=await tmdbFetch(`/tv/${tmdbId}/external_ids`);tvdb=j.tvdb_id||0}catch(e){}
  if(!tvdb){ // fallback via tvmaze name search; shows TVDB doesn't know get an 'm_<tvmazeId>' id
    try{const r=await fetch(`${TVM}/singlesearch/shows?q=${encodeURIComponent(name)}`);
      if(r.ok){const j=await r.json();mid=j.id;tvdb=j.externals?.thetvdb||('m_'+j.id)}}catch(e){}
  }
  if(!tvdb){toast('Could not match this show');return}
  await addShow({tvdb,name,mid,tmdbId});
}

window.addShow=async p=>{
  const id=''+p.tvdb;
  S.shows[id]={id,title:p.name,followed:true,favorite:false,userStatus:'plan',addedAt:new Date().toISOString(),archived:false};
  let full=await tvmLookup(id);
  // TVmaze may not know this TVDB id: fall back to its TVmaze id, then to a name search
  try{
    if(!full&&!p.mid){const r=await fetch(`${TVM}/singlesearch/shows?q=${encodeURIComponent(p.name)}`);if(r.ok)p.mid=(await r.json()).id}
    if(!full&&p.mid){const r=await fetch(`${TVM}/shows/${p.mid}`);if(r.ok)full=normTvm(await r.json())}
  }catch(e){}
  // no placeholder on failure: leaving S.tvm empty lets the background matcher retry later
  if(full){if(p.tmdbId){full.tmdbId=+p.tmdbId;full.tmdbv=2}S.tvm[id]=full}
  else delete S.tvm[id];
  await save();toast(full?`${p.name} added`:`${p.name} added · episodes will load once it's matched`);
  location.hash='#/show/'+id;
};
