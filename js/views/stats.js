/* Watchlog · Stats screen: totals, per-month activity, top shows/genres/services, ratings */
let statYear=null; // null = pick a default on first visit; 'all' = all time
const EP_MIN_FALLBACK=42; // minutes per episode when TVmaze has no runtime for a show

// every episode watch and movie watch, with its date and minutes
function statEvents(){
  const eps=[],mov=[];
  for(const [sid,w] of Object.entries(S.watched)){
    const rt=S.tvm[sid]?.runtime||0;
    for(const x of Object.values(w)){
      if(!x.d)continue;
      eps.push({sid,d:String(x.d).slice(0,10),n:x.n||1,min:rt||EP_MIN_FALLBACK,est:!rt});
    }
  }
  for(const m of Object.values(S.movies)){
    if(m.status!=='watched')continue;
    const min=getMeta(m)?.runtime||m.runtime||0;
    [...(m.history||[]),m.watchDate].forEach(d=>{if(d)mov.push({m,d:String(d).slice(0,10),min})});
    // imported rewatch counts without dates count once more, on the latest date
    const extra=(m.rewatch||0)-(m.history||[]).length;
    for(let i=0;i<extra;i++)if(m.watchDate)mov.push({m,d:String(m.watchDate).slice(0,10),min});
  }
  return {eps,mov};
}
window.setStatYear=y=>{statYear=y;render(false)};
const fmtHours=min=>{const h=Math.round(min/60);return h>=1000?`${(h/1000).toFixed(1)}k`:String(h)};
function statTile(v,label,note){
  return `<div class="stile"><b>${v}</b><span>${label}</span>${note?`<i>${note}</i>`:''}</div>`;
}
// single-series column chart; one gold hue, peak labelled, tap/hover a bar for its value
function colChart(title,cols){
  const max=Math.max(1,...cols.map(c=>c.v));
  const peak=cols.reduce((a,c,i)=>c.v>cols[a].v?i:a,0);
  const total=cols.reduce((a,c)=>a+c.v,0);
  return `<div class="set"><h3>${title}</h3>
    ${total?`<div class="cols" role="img" aria-label="${esc(title)}: ${cols.map(c=>`${c.full} ${c.v}`).join(', ')}">
      ${cols.map((c,i)=>`<div class="col" tabindex="0">
        <span class="tip">${esc(c.full)} · ${c.v}</span>
        <div class="colbar-wrap">${i===peak&&c.v?`<span class="peak">${c.v}</span>`:''}
          <div class="colbar" style="height:${c.v?Math.max(3,c.v/max*100):0}%"></div></div>
        <span class="lab">${esc(c.l)}</span></div>`).join('')}
    </div>`:'<p>Nothing watched in this period.</p>'}</div>`;
}
// ranked horizontal bars; values sit in text colour beside the bar
function rankList(title,rows,unit){
  if(!rows.length)return'';
  const max=rows[0].v;
  return `<div class="set"><h3>${title}</h3>${rows.map(r=>`
    <${r.href?`a href="${r.href}"`:'div'} class="rank">
      <div class="rank-t"><span>${esc(r.l)}</span><b>${r.v}${unit?` ${unit}`:''}</b></div>
      <div class="rank-bar"><i style="width:${Math.max(2,r.v/max*100)}%"></i></div>
    </${r.href?'a':'div'}>`).join('')}</div>`;
}
const pl=(n,one,many)=>n===1?one:many;
const topN=(counts,n)=>Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n);
function vStats(){
  const {eps,mov}=statEvents();
  const years=[...new Set([...eps,...mov].map(x=>x.d.slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();
  const thisYear=_today().slice(0,4);
  if(statYear===null)statYear=years.includes(thisYear)?thisYear:'all';
  if(statYear!=='all'&&!years.includes(statYear))statYear='all';
  const inP=x=>statYear==='all'||x.d.startsWith(statYear);
  const E=eps.filter(inP),M=mov.filter(inP);
  const epCount=E.reduce((a,x)=>a+x.n,0);
  const tvMin=E.reduce((a,x)=>a+x.min*x.n,0),estimated=E.some(x=>x.est);
  const mvMin=M.reduce((a,x)=>a+x.min,0);
  const showsWatched=new Set(E.map(x=>x.sid));
  const completed=Object.values(S.shows).filter(s=>showState(s)==='completed').length;

  // months: a calendar year, or the last 12 months for "all time"
  let months=[];
  if(statYear==='all'){
    const d=new Date();d.setDate(1);
    for(let i=11;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);months.push(_ymd(x).slice(0,7))}
  }else for(let i=1;i<=12;i++)months.push(`${statYear}-${_pad(i)}`);
  const perMonth=(list,w)=>months.map(k=>{
    const [y,mo]=k.split('-');
    return {l:MON[+mo-1][0],full:`${MON[+mo-1]} ${y}`,v:list.filter(x=>x.d.startsWith(k)).reduce((a,x)=>a+w(x),0)};
  });
  const monthScope=statYear==='all'?' · last 12 months':'';

  const byShow={},byGenre={},bySvc={};
  E.forEach(x=>{
    byShow[x.sid]=(byShow[x.sid]||0)+x.n;
    (S.tvm[x.sid]?.genres||[]).forEach(g=>{g=normGenre(g);byGenre[g]=(byGenre[g]||0)+x.n});
    const p=itemProv({...S.shows[x.sid],_t:'s'})[0];if(p)bySvc[p.n]=(bySvc[p.n]||0)+x.n;
  });
  M.forEach(x=>(getMeta(x.m)?.genres||[]).forEach(g=>{g=normGenre(g);byGenre[g]=(byGenre[g]||0)+1}));
  const topShows=topN(byShow,5).filter(([id])=>S.shows[id]).map(([id,v])=>({l:S.shows[id].title,v,href:`#/show/${id}`}));
  const topGenres=topN(byGenre,6).map(([l,v])=>({l,v}));
  const topSvc=topN(bySvc,5).map(([l,v])=>({l,v}));

  // ratings you've given (all time; ratings carry no date)
  const er=S.epRatings.filter(r=>r.v!=null),mr=Object.values(S.movieRatings).filter(v=>v!=null);
  const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'–';
  const bestMovies=[...new Map(M.map(x=>[x.m.id,x.m])).values()]
    .filter(m=>S.movieRatings[m.title]!=null).sort((a,b)=>S.movieRatings[b.title]-S.movieRatings[a.title]).slice(0,5)
    .map(m=>({l:m.title,v:S.movieRatings[m.title],href:'#/movie/'+encodeURIComponent(m.id)}));

  return `<header class="hdr" style="justify-content:flex-start;gap:10px">
    <button class="iconbtn" onclick="history.back()" aria-label="Back">‹</button><div class="name">Stats</div></header>
  <div class="chips" style="margin-bottom:14px">
    <button class="chip ${statYear==='all'?'on':''}" onclick="setStatYear('all')">All time</button>
    ${years.map(y=>`<button class="chip ${statYear===y?'on':''}" onclick="setStatYear('${y}')">${y}</button>`).join('')}
  </div>
  <div class="stiles">
    ${statTile(epCount.toLocaleString(),pl(epCount,'episode','episodes'))}
    ${statTile(fmtHours(tvMin),'hours of TV',estimated?'some runtimes estimated':'')}
    ${statTile(M.length.toLocaleString(),pl(M.length,'movie watched','movies watched'))}
    ${statTile(fmtHours(mvMin),'hours of movies')}
    ${statTile(showsWatched.size,pl(showsWatched.size,'show watched','shows watched'))}
    ${statTile(completed,pl(completed,'show completed','shows completed'),'all time')}
  </div>
  ${colChart('Episodes per month'+monthScope,perMonth(E,x=>x.n))}
  ${colChart('Movies per month'+monthScope,perMonth(M,()=>1))}
  ${rankList('Top shows',topShows,'eps')}
  ${rankList('Top genres',topGenres,'')}
  ${rankList(`Where you watched · ${regionInfo()[1]}`,topSvc,'eps')}
  <div class="set"><h3>Your ratings</h3>
    <p>${er.length} ${pl(er.length,'episode','episodes')} rated · average ${avg(er.map(r=>r.v))} ★<br>${mr.length} ${pl(mr.length,'movie','movies')} rated · average ${avg(mr)} ★</p></div>
  ${rankList('Your top-rated movies'+(statYear==='all'?'':` · ${statYear}`),bestMovies,'★')}`;
}
