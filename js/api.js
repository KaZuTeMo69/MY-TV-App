/* Watchlog · TVmaze + TMDB: show matching, episodes, trailers, providers per region, cast, movie details */
/* ============ TVmaze API ============ */
const TVM='https://api.tvmaze.com';
// show ids are TVDB ids, or 'm_<tvmazeId>' for shows TVDB doesn't know
const tvmFetch=id=>String(id).startsWith('m_')?fetch(`${TVM}/shows/${String(id).slice(2)}`)
  :fetch(`${TVM}/lookup/shows?thetvdb=${id}`);
async function tvmLookup(tvdbId){
  try{
    const r=await tvmFetch(tvdbId);
    if(!r.ok) return null;
    return normTvm(await r.json());
  }catch(e){return null}
}
function normTvm(j){
  if(!j) return null;
  return {mid:j.id,img:j.image?.medium||'',imgBig:j.image?.original||'',status:j.status||'',
    premiered:(j.premiered||'').slice(0,4),genres:(j.genres||[]).slice(0,3),
    network:j.network?.name||j.webChannel?.name||'',rating:j.rating?.average||null,
    runtime:j.averageRuntime||null,summary:(j.summary||'').replace(/<[^>]+>/g,'').slice(0,400)};
}
async function tvmEpisodes(mid){
  try{
    const r=await fetch(`${TVM}/shows/${mid}/episodes`);
    if(!r.ok) return null;
    return (await r.json()).map(e=>({s:e.season,e:e.number,name:e.name||'',air:e.airdate||'',img:e.image?.medium||''}));
  }catch(e){return null}
}
const _trailerTried=new Set();
// '' is stored only when TMDB answered with no trailer; a failed request stays undefined
// so it's retried on a later visit (once per session, so a dead network can't loop renders)
async function tvTrailer(id){
  if(!S.keys.tmdb||_trailerTried.has(id))return;
  const tv=S.tvm[id];if(!tv||tv.trailer!==undefined)return;
  _trailerTried.add(id);
  try{
    const tid=await showTmdbId(id);
    if(tid===null)return;
    let key='';
    if(tid){
      const v=await tmdbFetch(`/tv/${tid}/videos`);
      const vids=v.results||[];
      const tr=vids.find(x=>x.site==='YouTube'&&x.type==='Trailer'&&x.official)||vids.find(x=>x.site==='YouTube'&&x.type==='Trailer')||vids.find(x=>x.site==='YouTube');
      if(tr)key=tr.key;
    }
    tv.trailer=key;
  }catch(e){return}
  await saveOne('tvm');render(false);
}
const _epBusy=new Set();
// returns TRUE only when fresh data was actually fetched, so callers can re-render
// without looping. Cache-hits and failures return false.
async function ensureEpisodes(id,force){
  const tv=S.tvm[id]; if(!tv||!tv.mid) return false;
  if(_epBusy.has(id)) return false;
  if(!force && tv.eps && tv.eps[0] && tv.eps[0].img!==undefined){
    // "near air" spans 2 days before broadcast to 5 days after — TVmaze usually
    // uploads the episode still after it airs, so the window has to cover both sides
    const near=tv.eps.some(e=>{if(!e.air)return false;
      const d=daysTo(e.air); return d<=2 && d>=-5});
    const maxAge=near?3600e3*6:86400e3*3;
    if(Date.now()-(tv.epsAt||0) < maxAge) return false;
  }
  _epBusy.add(id);
  try{
    const eps=await tvmEpisodes(tv.mid);
    if(eps){tv.eps=eps;tv.epsAt=Date.now();await saveOne('tvm');return true}
    return false;
  } finally { _epBusy.delete(id) }
}

/* background matcher: fill tvm data for all shows */
let matching=false;
async function backgroundMatch(force){
  if(matching) return; matching=true;
  // a forced run retries titles that previously failed to match
  if(force){for(const k in S.tvm)if(k.startsWith('miss_'))delete S.tvm[k]}
  // priority: recently-watched first, then followed, then the rest
  const prio=id=>{const s=S.shows[id];const lw=lastWatch(id);
    return (lw?'2'+lw:(s.followed?'1':'0')+'0000000000000000000')};
  const ids=Object.keys(S.shows)
    .filter(id=>!S.tvm[id] && !id.startsWith('x_') && !S.tvm['miss_'+id])
    .sort((a,b)=>prio(b).localeCompare(prio(a)));
  const bar=$('#matchbar');
  for(let i=0;i<ids.length;i++){
    let res=null,tries=0;
    while(tries<3){
      try{
        const r=await tvmFetch(ids[i]);
        if(r.status===429){tries++;await new Promise(x=>setTimeout(x,4000));continue}
        if(r.ok) res=normTvm(await r.json());
        break;
      }catch(e){break}
    }
    if(res) S.tvm[ids[i]]=res; else S.tvm['miss_'+ids[i]]=1;
    if(i%6===0){await saveOne('tvm'); render(false);}
    bar.style.transform=`scaleX(${(i+1)/ids.length})`;
    await new Promise(r=>setTimeout(r,520));
  }
  await saveOne('tvm');
  bar.style.transform='scaleX(0)';
  matching=false; render(false);
  if(ids.length) toast('Artwork & show data updated');
  // prefetch episode lists (needed for progress %, next-up and countdowns)
  // normal run: only shows with no episode list yet.
  // forced run: also re-pull still-running shows, so new stills and newly aired episodes land.
  const act=Object.values(S.shows)
    .filter(s=>(watchedCount(s.id)>0||s.followed)&&!s.archived&&S.tvm[s.id]
      &&(force?S.tvm[s.id].status!=='Ended':!S.tvm[s.id].eps))
    .sort((a,b)=>lastWatch(b.id).localeCompare(lastWatch(a.id)));
  for(let i=0;i<act.length;i++){
    await ensureEpisodes(act[i].id,force);
    if(i%10===0)render(false);
    await new Promise(r=>setTimeout(r,520));
  }
  if(force)toast(`Refreshed ${act.length} show${act.length===1?'':'s'}`);
  render(false);
}

const PROV_ALIAS=[[/ (standard |basic )?with ads$/i,''],[/ amazon channel$/i,''],[/ apple tv channel$/i,''],[/^amazon (prime )?video$/i,'Prime Video'],[/^prime video.*/i,'Prime Video'],[/^netflix.*/i,'Netflix'],[/^disney plus$/i,'Disney+'],[/^apple tv\+?$/i,'Apple TV+'],[/^apple tv$/i,'Apple TV+'],[/^osn\+?.*/i,'OSN+'],[/^shahid.*/i,'Shahid'],[/^starzplay.*/i,'STARZPLAY'],[/^hbo max$/i,'HBO Max'],[/^watch ?it.*/i,'Watch It'],[/^yango.*/i,'Yango Play']];
function normProv(n){
  let x=(n||'').trim();
  for(const [re,to] of PROV_ALIAS){if(re.test(x)){x=to||x.replace(re,'').trim()}}
  return x;
}
const GENRE_ALIAS={'Science Fiction':'Sci-Fi','Sci-Fi & Fantasy':'Sci-Fi','Science-Fiction':'Sci-Fi','Action & Adventure':'Action','War & Politics':'War','Mystery ':'Mystery'};
const normGenre=g=>GENRE_ALIAS[g]||g;
const TMDB_GENRES={28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Science Fiction',10770:'TV Movie',53:'Thriller',10752:'War',37:'Western',10759:'Action & Adventure',10762:'Kids',10763:'News',10764:'Reality',10765:'Sci-Fi & Fantasy',10766:'Soap',10767:'Talk',10768:'War & Politics'};
const tmdbFetch=async path=>{
  const sep=path.includes('?')?'&':'?';
  const r=await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${S.keys.tmdb}`);
  if(!r.ok)throw new Error('tmdb '+r.status);
  return r.json();
};
// crew payload -> directors, de-duplicated (a crew list can repeat a name per department)
function dirList(crew){
  const out=[],seen=new Set();
  for(const c of (crew||[])){
    if(c.job!=='Director'||seen.has(c.id))continue;
    seen.add(c.id);
    out.push({n:c.name||'',pid:c.id,img:c.profile_path?`https://image.tmdb.org/t/p/w185${c.profile_path}`:''});
    if(out.length>=4)break;
  }
  return out;
}
const REGIONS=[['SA','Saudi Arabia','🇸🇦'],['EG','Egypt','🇪🇬'],['AE','UAE','🇦🇪']];
const region=()=>S.prefs.region||'SA';
const regionInfo=(c=region())=>REGIONS.find(r=>r[0]===c)||REGIONS[0];
// watch-providers payload -> every supported region, so switching region needs no refetch.
// A region with no entry means TMDB lists no streaming for it; we never borrow another region's.
function provPick(j){
  const r={};
  REGIONS.forEach(([c])=>{
    const rg=j.results?.[c];if(!rg)return;
    const seen={},p=[];
    ['flatrate','free','ads'].forEach(k=>(rg[k]||[]).forEach(x=>{
      if(!seen[x.provider_name]){seen[x.provider_name]=1;
        p.push({n:x.provider_name,l:x.logo_path?`https://image.tmdb.org/t/p/w45${x.logo_path}`:''})}}));
    r[c]={link:rg.link||'',p:p.slice(0,8)};
  });
  return {v:2,r};
}
// providers for the current region: null = not fetched yet, {p:[]} = none listed there
function provFor(key){
  const x=S.prov[key];
  if(!x||x.v!==2)return null;
  return x.r[region()]||{link:'',p:[]};
}
// TMDB id for a library show. TVDB-id lookup first (exact), title+year search as fallback.
// Returns null when the request failed, so callers can retry later instead of caching a miss.
async function showTmdbId(id){
  const tv=S.tvm[id];if(!tv)return 0;
  if(tv.tmdbv===2)return tv.tmdbId||0;
  let tid=0;
  try{
    if(/^\d+$/.test(id)){
      const j=await tmdbFetch(`/find/${id}?external_source=tvdb_id`);
      tid=j.tv_results?.[0]?.id||0;
    }
    const title=S.shows[id]?.title||'';
    if(!tid&&title){
      const y=tv.premiered?`&first_air_date_year=${tv.premiered}`:'';
      let j=await tmdbFetch(`/search/tv?query=${encodeURIComponent(title)}${y}`);
      if(!j.results?.length&&y)j=await tmdbFetch(`/search/tv?query=${encodeURIComponent(title)}`);
      tid=j.results?.[0]?.id||0;
    }
  }catch(e){return null}
  if(tv.tmdbId&&tv.tmdbId!==tid){ // an earlier title-only search picked the wrong show
    delete tv.cast;delete tv.castv;delete tv.trailer;delete S.prov['s'+id];
  }
  tv.tmdbId=tid;tv.tmdbv=2;
  return tid;
}
/* background: posters, genres and providers for the whole library */
let provRunning=false;
async function providerMatch(){
  if(provRunning||!S.keys.tmdb)return;provRunning=true;
  try{
    // movies: details (poster/genres/trailer/credits/providers) for anything not fetched yet
    const ms=Object.values(S.movies).filter(m=>getMeta(m)===undefined);
    for(let i=0;i<ms.length;i++){
      await tmdbMovieMeta(ms[i]);
      if(i%12===0)render(false);
      await new Promise(r=>setTimeout(r,130));
    }
    // movies whose providers are missing or in the old single-region format
    const mp=Object.values(S.movies).filter(m=>provFor('m'+m.id)===null&&getMeta(m)?.tmdbId);
    for(let i=0;i<mp.length;i++){
      try{S.prov['m'+mp[i].id]=provPick(await tmdbFetch(`/movie/${getMeta(mp[i]).tmdbId}/watch/providers`))}catch(e){}
      if(i%10===0){await saveOne('prov');render(false)}
      await new Promise(r=>setTimeout(r,130));
    }
    // shows: resolve tmdb id + providers
    const ss=Object.values(S.shows).filter(s=>provFor('s'+s.id)===null&&S.tvm[s.id]);
    for(let i=0;i<ss.length;i++){
      const sh=ss[i];
      const tid=await showTmdbId(sh.id);
      try{
        if(tid)S.prov['s'+sh.id]=provPick(await tmdbFetch(`/tv/${tid}/watch/providers`));
        else if(tid===0)S.prov['s'+sh.id]={v:2,r:{}};
      }catch(e){}
      if(i%10===0){await saveOne('prov');await saveOne('tvm');render(false)}
      await new Promise(r=>setTimeout(r,150));
    }
    await saveOne('prov');await saveOne('tvm');await saveOne('movies');
  }catch(e){}
  provRunning=false;render(false);
}

/* TVmaze cast for shows */
const _castTried=new Set();
// castv:2 means the cast entries carry TMDB person ids, so they can open a person card.
// TVmaze has no person ids, so it stays the fallback for when there's no TMDB key.
async function showCast(id){
  const tv=S.tvm[id];if(!tv)return;
  let viaTmdb=false;
  if(S.keys.tmdb){
    try{
      const tid=await showTmdbId(id);
      if(tid){
        const c=await tmdbFetch(`/tv/${tid}/aggregate_credits`);
        tv.cast=(c.cast||[]).slice(0,14).map(x=>({n:x.name||'',c:x.roles?.[0]?.character||'',pid:x.id,
          img:x.profile_path?`https://image.tmdb.org/t/p/w185${x.profile_path}`:''}));
        tv.castv=2; viaTmdb=true;
      }
    }catch(e){}
  }
  if(!viaTmdb && tv.cast===undefined && tv.mid){
    try{
      const r=await fetch(`${TVM}/shows/${tv.mid}/cast`);
      if(r.ok)tv.cast=(await r.json()).slice(0,14).map(c=>({n:c.person?.name||'',c:c.character?.name||'',img:c.person?.image?.medium||''}));
    }catch(e){}
  }
  if(tv.cast===undefined)tv.cast=[];
  await saveOne('tvm');render(false);
}

const _metaTried=new Set();
// movie caches are keyed by the library id, so two films sharing a title never share data
const mkey=m=>'#'+m.id;
const getMeta=m=>S.tmdbMeta[mkey(m)];
const getPoster=m=>S.tmdbPosters[mkey(m)];
const movieTmdbId=m=>m.tmdbId||(String(m.id).startsWith('tmdb_')?+String(m.id).slice(5):0)||getMeta(m)?.tmdbId||0;
async function tmdbMovieMeta(m){
  if(!S.keys.tmdb)return null;
  const have=getMeta(m);
  // cv:2 adds person ids and directors; older cached entries get upgraded lazily.
  // null means "searched and found nothing" — don't keep retrying those.
  if(have!==undefined&&(have===null||have.cv===2))return have;
  try{
    let tid=movieTmdbId(m);
    if(!tid){
      const y=m.releaseDate?`&year=${m.releaseDate.slice(0,4)}`:'';
      const hit=(await tmdbFetch(`/search/movie?query=${encodeURIComponent(m.title)}${y}`)).results?.[0];
      if(!hit){S.tmdbMeta[mkey(m)]=null;await saveOne('tmdbMeta');return null}
      tid=hit.id;
    }
    const d=await tmdbFetch(`/movie/${tid}?append_to_response=videos,credits,watch%2Fproviders`);
    const vids=d.videos?.results||[];
    const tr=vids.find(v=>v.site==='YouTube'&&v.type==='Trailer'&&v.official)||vids.find(v=>v.site==='YouTube'&&v.type==='Trailer')||vids.find(v=>v.site==='YouTube');
    const meta={poster:d.poster_path?`https://image.tmdb.org/t/p/w342${d.poster_path}`:'',
      backdrop:d.backdrop_path?`https://image.tmdb.org/t/p/w780${d.backdrop_path}`:'',
      rating:d.vote_average?+d.vote_average.toFixed(1):null,
      genres:(d.genres||[]).map(g=>g.name).slice(0,3),
      overview:(d.overview||'').slice(0,420),runtime:d.runtime||null,
      date:d.release_date||'',trailer:tr?tr.key:'',tmdbId:tid,cv:2,
      cast:(d.credits?.cast||[]).slice(0,14).map(c=>({n:c.name||'',c:c.character||'',pid:c.id,img:c.profile_path?`https://image.tmdb.org/t/p/w185${c.profile_path}`:''})),
      dir:dirList(d.credits?.crew)};
    S.prov['m'+m.id]=provPick(d['watch/providers']||{results:{}});
    S.tmdbMeta[mkey(m)]=meta;m.tmdbId=tid;
    if(meta.date&&!m.releaseDate)m.releaseDate=meta.date;
    if(meta.poster)S.tmdbPosters[mkey(m)]=meta.poster.replace('w342','w185');
    await saveOne('movies');await saveOne('tmdbMeta');await saveOne('tmdbPosters');await saveOne('prov');
    return meta;
  }catch(e){return null}
}
