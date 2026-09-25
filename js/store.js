/* Watchlog · IndexedDB wrapper and app state (S), with save helpers */
/* ============ tiny IndexedDB ============ */
const DB = {
  db:null,
  open(){return new Promise((res,rej)=>{
    const r = indexedDB.open('watchlog',1);
    r.onupgradeneeded = e=>{
      const d = e.target.result;
      d.createObjectStore('kv');
    };
    r.onsuccess = e=>{DB.db=e.target.result;res()};
    r.onerror = rej;
  })},
  get(k){return new Promise(res=>{
    const t = DB.db.transaction('kv').objectStore('kv').get(k);
    t.onsuccess=()=>res(t.result); t.onerror=()=>res(null);
  })},
  set(k,v){return new Promise(res=>{
    const t = DB.db.transaction('kv','readwrite').objectStore('kv').put(v,k);
    t.onsuccess=()=>res(); t.onerror=()=>res();
  })}
};

/* ============ state ============ */
let S = {
  shows:{},        // id -> {id,title,followed,favorite,userStatus,addedAt,archived}
  watched:{},      // showId -> {"s-e":{d,n}}
  movies:{},       // id -> {id,title,status,watchDate,releaseDate,runtime,rewatch}
  epRatings:[], movieRatings:{},
  tvm:{},          // tvdbId -> tvmaze show cache {mid,img,fan,status,premiered,genres,network,rating,eps:[{s,e,name,air}],epsAt}
  keys:{tmdb:'',omdb:''},
  prefs:{listView:'grid',name:'',region:'SA',services:[]},
  tmdbMeta:{},
  prov:{},   // 's<tvdbId>' | 'm<movieId>' -> {v:2,r:{SA|EG|AE:{link,p:[{n,l}]}}} watch providers per region
  tmdbPosters:{},  // '#'+movieId -> poster url (tmdbMeta is keyed the same way)
  loaded:false
};
const save = async ()=>{ for(const k of ['shows','watched','movies','epRatings','movieRatings','tvm','keys','tmdbPosters','prefs','tmdbMeta','prov']) await DB.set(k,S[k]); };
const saveOne = k => DB.set(k,S[k]);
