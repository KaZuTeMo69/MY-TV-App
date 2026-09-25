/* Watchlog · Shared helpers: escaping, toasts, local-time dates, show/episode state */
/* ============ helpers ============ */
const $ = s=>document.querySelector(s);
const esc = s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = m=>{const t=$('#toast');t.textContent=m;t.classList.remove('act');t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2400)};
// toast with one tappable action, e.g. "S2 E5 ✓ · Also mark 4 earlier"
function toastAct(m,label,fn){
  const t=$('#toast');t.textContent=m+' ';
  const b=document.createElement('button');b.textContent=label;
  b.onclick=()=>{t.classList.remove('show','act');fn()};
  t.appendChild(b);t.classList.add('show','act');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show','act'),5000);
}
// a value placed inside a double-quoted onclick="fn(...)" as a JS string literal
const jsa=v=>esc(JSON.stringify(String(v)));
const epKey=(s,e)=>`${s}-${e}`;
const watchedCount = id => Object.keys(S.watched[id]||{}).length;
const lastWatch = id => Object.values(S.watched[id]||{}).reduce((a,x)=>x.d>a?x.d:a,'');
const fmtMin = m=>{if(!m)return'';const h=Math.floor(m/60);return h>=1?`${h}h ${m%60}m`:`${m}m`};
const _pad=n=>String(n).padStart(2,'0');
const _ymd=d=>`${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
// dates follow the phone's own clock/timezone, never UTC
const _today=()=>_ymd(new Date());
const _stamp=()=>{const d=new Date();return `${_ymd(d)} ${_pad(d.getHours())}:${_pad(d.getMinutes())}:${_pad(d.getSeconds())}`};
// "YYYY-MM-DD" is read as local midnight (new Date() would read it as UTC midnight)
function parseDay(ds){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ds||'');
  return m?new Date(+m[1],+m[2]-1,+m[3]):new Date(ds);
}
const _midnight=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
// whole calendar days from today to ds (negative = in the past)
const daysTo=ds=>Math.round((_midnight(parseDay(ds))-_midnight(new Date()))/864e5);
const epFuture=e=>!!e.air && e.air>_today();  // live check, never trust a cached snapshot

function showState(sh){
  const tv=S.tvm[sh.id], wc=watchedCount(sh.id);
  if(sh.userStatus==='later') return 'onhold';
  if(sh.userStatus==='plan'&&!wc) return 'plan';
  if(tv&&tv.eps&&wc>=tv.eps.filter(e=>!epFuture(e)).length&&wc>0){
    return tv.status==='Ended'?'completed':(nextEp(sh.id)?'watching':'uptodate');
  }
  if(sh.archived) return 'onhold';
  if(wc>0) return 'watching';
  return 'plan';
}
function nextEp(id){
  const tv=S.tvm[id]; if(!tv||!tv.eps) return null;
  const w=S.watched[id]||{};
  return tv.eps.find(e=>!epFuture(e) && !w[epKey(e.s,e.e)])||null;
}
function upcomingEp(id){
  const tv=S.tvm[id]; if(!tv||!tv.eps) return null;
  const up=tv.eps.find(e=>epFuture(e));
  if(!up) return null;
  return {...up,days:daysTo(up.air)};
}
const inDays=d=>d<=0?'today':d===1?'tomorrow':`in ${d}d`;
const agoDays=ds=>{const d=-daysTo(String(ds).slice(0,10));return d<=0?'today':d===1?'1d ago':`${d}d ago`};
const USTAT=[['all','All'],['watching','Watching'],['towatch','To watch'],['done','Done'],['uptodate','Up to date'],['later','Later'],['upcoming','Upcoming']];
function uniState(it){ // -> one of watching/towatch/done/uptodate/later/upcoming-included set
  if(it._t==='m'){
    const st=[];
    if(it.status==='watched')st.push('done');else st.push('towatch');
    if(it.status!=='watched'&&it.releaseDate&&it.releaseDate>=_today())st.push('upcoming');
    return st;
  }
  const s=showState(it), map={watching:'watching',plan:'towatch',completed:'done',uptodate:'uptodate',onhold:'later'};
  const st=[map[s]||'towatch'];
  if(upcomingEp(it.id))st.push('upcoming');
  return st;
}
function newEp(id){
  const nx=nextEp(id); if(!nx||!nx.air) return null;
  const age=-daysTo(nx.air);
  return age>=0&&age<=14?nx:null;
}
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(ds){if(!ds)return'';const d=parseDay(String(ds).slice(0,10));if(isNaN(d))return ds;
  const days=daysTo(_ymd(d));
  if(days>=0&&days<=7)return inDays(days);
  const s=`${MON[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear()===new Date().getFullYear()?s:`${s} ${d.getFullYear()}`}
