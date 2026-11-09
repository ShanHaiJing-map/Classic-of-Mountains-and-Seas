(function(){
'use strict';
const D=window.SHJ_DATA, W=1536, H=1024;
const ALL=[...D.b.map(e=>(e.k='b',e)),...D.p.map(e=>(e.k='p',e))];
const ORDER=['南山經','西山經','北山經','東山經','中山經','海外南經','海外西經','海外北經','海外東經','海內南經','海內西經','海內北經','海內東經','大荒東經','大荒南經','大荒西經','大荒北經','海內經'];
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=id=>document.getElementById(id);
document.getElementById('sb').textContent=D.b.length;document.getElementById('sp').textContent=D.p.length;

window.shjPh=img=>{const d=img.parentNode;if(d)d.innerHTML='<span class="ph">'+img.dataset.ch+'</span>'};
/* ---------- 圖像：images/ 資料夾有圖就顯示，沒有就顯示朱印 ---------- */
function picHTML(e,big){
  const ch=esc([...e.n.replace(/[（）()]/g,'')][0]||'');
  const ph=`<span class="ph">${ch}</span>`;
  if(!e.pic) return `<div class="pic${big?' big':''}">${ph}</div>`;
  return `<div class="pic${big?' big':''}"><img src="images/${esc(e.pic)}" alt="${esc(e.n)}" loading="lazy" data-ch="${ch}" onerror="shjPh(this)"></div>`;
}
function annotHTML(a){
  return String(a||'').split('\n').filter(Boolean).map(line=>{
    if(line.startsWith('（出處')||line.startsWith('郝本此條無注'))return `<p class="src">${esc(line)}</p>`;
    let sn='',body=line;const m=line.match(/^【(.*?)】(.*)$/);if(m){sn=m[1];body=m[2]}
    body=esc(body).replace(/郭璞注：/g,'<span class="tag guo">郭璞注</span>').replace(/　?郝懿行案：/g,' <span class="tag hao">郝懿行案</span>');
    return `<p>${sn?`<span class="sn">「${esc(sn)}」</span><br>`:''}${body}</p>`}).join('');
}
function detailHTML(e,withMapBtn){
  const kind=e.k==='b'?'異獸神禽':'異人邦國';
  return `<div class="dhead">${picHTML(e,true)}<div style="min-width:0"><h2 class="ename">${esc(e.n)}</h2>
    <div class="meta"><span class="chip">${kind}${e.c?'・'+esc(e.c):''}</span><span class="chip">〈${esc(e.s)}〉</span>${e.pl?`<span class="chip">${esc(e.pl)}</span>`:''}</div>
    ${e.a?`<div class="src">又名：${esc(e.a)}</div>`:''}
    ${withMapBtn?`<div class="actions"><button class="btn" data-goto="${e.id}">在地圖上看</button></div>`:''}</div></div>
  <div class="label">原文</div><div class="text">${esc(e.t)}</div>
  <div class="label">注釋</div><div class="an">${annotHTML(e.an)}</div>
`;
}

/* ---------- 地圖：沿用現有平面像素座標，無須導入 Leaflet ---------- */
const map=$('map'),stage=$('stage'),mdet=$('mapdetail');
const preview=$('marker-preview'),picker=$('marker-picker'),rail=$('chapter-rail');
let s=1,tx=0,ty=0,sel=null,fitted=false;
let renderedScale=NaN,renderToken=0;
const defaultHint='<div class="hint"><h2>探索《山海經》</h2>拖曳上方經卷導覽軸，選擇篇章。滑鼠懸停標記可預覽原文；點擊標記後在這裡閱讀完整原文與注釋。密集標記可點擊展開。</div>';
function chapterIntroHTML(ch){
  const info=window.SHJ_CHAPTER_INFO?.[ch];
  if(!info)return `<div class="hint"><h2>〈${esc(ch)}〉</h2><p>此篇介紹尚未收錄。</p></div>`;
  const count=ALL.filter(e=>e.s===ch).length;
  const intro=String(info.introduction||'').split('\n').filter(Boolean)
    .map(t=>`<p>${esc(t)}</p>`).join('');
  const originals=(info.original||[]).map(t=>`<p class="intro-quote">${esc(t)}</p>`).join('');
  const notes=(info.notes||[]).map(t=>`<p class="intro-note">${esc(t)}</p>`).join('');
  return `<div class="chapter-intro"><h2>〈${esc(ch)}〉</h2>
    <div class="intro-count">本網站收錄 ${count} 條相關資料 · 經卷簡介</div>
    ${intro}
    <details><summary>閱讀本篇原文選錄（${(info.original||[]).length} 則）</summary>
      ${originals}${notes}
    </details>
  </div>`;
}
function showChapterIntro(ch){sel=null;mdet.innerHTML=ch?chapterIntroHTML(ch):defaultHint;mdet.scrollTop=0;queueMarkers()}
mdet.innerHTML=defaultHint;
function minS(){const r=map.getBoundingClientRect();return Math.max(r.width/W,r.height/H)}
function clamp(){const r=map.getBoundingClientRect();if(!r.width)return;s=Math.max(s,minS());tx=Math.min(0,Math.max(r.width-W*s,tx));ty=Math.min(0,Math.max(r.height-H*s,ty))}
function apply(){clamp();stage.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;stage.style.setProperty('--inv',(1/Math.max(s,.35)).toFixed(3));if(Math.abs(renderedScale-s)>.01)queueMarkers()}
function fit(){const r=map.getBoundingClientRect();if(!r.width)return;s=Math.max(r.width/W,r.height/H);tx=(r.width-W*s)/2;ty=(r.height-H*s)/2;apply();fitted=true}
function zoomAt(f,cx,cy){const ns=Math.min(8,Math.max(minS(),s*f));tx=cx-(cx-tx)*ns/s;ty=cy-(cy-ty)*ns/s;s=ns;apply();hidePreview();closePicker()}
function animateStage(){stage.classList.add('anim');clearTimeout(animateStage.timer);animateStage.timer=setTimeout(()=>stage.classList.remove('anim'),510)}
function focusRecords(items){
  if(!items.length){fit();return}
  const r=map.getBoundingClientRect();if(!r.width)return;
  const coords=items.filter(e=>Number.isFinite(e.x)&&Number.isFinite(e.y));if(!coords.length){fit();return}
  const xs=coords.map(e=>e.x),ys=coords.map(e=>H-e.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const dx=Math.max(100,xmax-xmin),dy=Math.max(95,ymax-ymin);
  const target=Math.min(3,Math.max(minS(),Math.min((r.width-105)/dx,(r.height-100)/dy)));
  s=target;tx=r.width/2-(xmin+xmax)/2*s;ty=r.height/2-(ymin+ymax)/2*s;
  animateStage();apply();fitted=true;
}
map.addEventListener('wheel',e=>{if(e.target.closest('.marker-picker'))return;e.preventDefault();const r=map.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
const pts=new Map();let last=null,pinch=null,moved=0;
map.addEventListener('pointerdown',e=>{if(e.target.closest('.zoom,.marker-picker,.dot'))return;hidePreview();closePicker();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;
  if(pts.size===1)last={x:e.clientX,y:e.clientY};
  if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}}});
map.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2&&pinch){const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const r=map.getBoundingClientRect();
    if(pinch.d>0)zoomAt(d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch.d=d;moved+=5;return}
  if(last){const dx=e.clientX-last.x,dy=e.clientY-last.y;moved+=Math.abs(dx)+Math.abs(dy);
    if(moved>4){map.classList.add('drag');try{map.setPointerCapture(e.pointerId)}catch(_){}}
    tx+=dx;ty+=dy;last={x:e.clientX,y:e.clientY};apply()}});
function up(e){pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size){last=null;map.classList.remove('drag')}else{const p=[...pts.values()][0];last={x:p.x,y:p.y}}}
map.addEventListener('pointerup',up);map.addEventListener('pointercancel',up);
const ctr=f=>{const r=map.getBoundingClientRect();zoomAt(f,r.width/2,r.height/2)};
$('zi').onclick=()=>ctr(1.5);$('zo').onclick=()=>ctr(1/1.5);$('zr').onclick=()=>{fit();hidePreview();closePicker()};
addEventListener('resize',()=>{if(route()==='map')fit()});
if(window.ResizeObserver){let lw=0,lh=0;new ResizeObserver(()=>{const r=map.getBoundingClientRect();if(r.width&&(Math.abs(r.width-lw)>1||Math.abs(r.height-lh)>1)){lw=r.width;lh=r.height;fit()}}).observe(map)}

/* 原始座標完全不修改；群組只在顯示層合併附近標記。 */
ALL.forEach(e=>{if(e.x!=null&&e.y!=null){e.px=+e.x;e.py=H-(+e.y)}});
ORDER.filter(ch=>ALL.some(e=>e.s===ch)).forEach(ch=>{const o=document.createElement('option');o.value=ch;o.textContent=ch;$('sec').appendChild(o)});
const byId=Object.fromEntries(ALL.map(e=>[e.id,e]));
const layer=document.createElement('div');layer.className='marker-layer';stage.appendChild(layer);
function eligible(e){const typ=e.k==='b'?$('cb').checked:$('cp').checked;const chapter=$('sec').value,query=$('q').value.trim();return typ&&(!chapter||e.s===chapter)&&(!query||[e.n,e.a,e.t,e.pl].some(v=>String(v||'').includes(query)))}
function queueMarkers(){if(renderToken)return;renderToken=requestAnimationFrame(()=>{renderToken=0;drawMarkers()})}
function drawMarkers(){
  renderedScale=s;hidePreview();closePicker();
  const active=ALL.filter(e=>e.px!==undefined&&eligible(e));$('mcount').textContent=`顯示 ${active.length}／${ALL.length} 條`;
  const radius=Math.max(3,31/Math.max(s,.2)),groups=[];
  for(const e of active){let nearest=null,best=radius*radius;
    for(const group of groups){const d=(group.cx-e.px)**2+(group.cy-e.py)**2;if(d<best){best=d;nearest=group}}
    if(nearest){nearest.members.push(e);const n=nearest.members.length;nearest.cx+=(e.px-nearest.cx)/n;nearest.cy+=(e.py-nearest.cy)/n}
    else groups.push({cx:e.px,cy:e.py,members:[e]});
  }
  const fragment=document.createDocumentFragment();
  for(const {members,cx,cy} of groups){
    const n=members.length;
    const el=document.createElement('button');el.type='button';el.style.left=cx+'px';el.style.top=cy+'px';
    const only=members[0],mixed=members.some(e=>e.k!==only.k);
    el.className=n===1?'dot '+only.k:'dot group'+(mixed?' mixed':'');
    el.textContent=n===1?'':String(n);
    el.setAttribute('aria-label',n===1?`${only.n}，${only.s}，點擊閱讀`:`${n}條資料，點擊展開`);
    if(n===1&&sel===only)el.classList.add('sel');
    el.addEventListener('pointerdown',ev=>ev.stopPropagation());
    el.addEventListener('mouseenter',()=>showPreview(el,members));
    el.addEventListener('focus',()=>showPreview(el,members));
    el.addEventListener('mouseleave',hidePreview);
    el.addEventListener('blur',hidePreview);
    el.addEventListener('click',ev=>{ev.stopPropagation();hidePreview();if(n===1)selectOnMap(only);else openPicker(el,members)});
    fragment.appendChild(el);
  }
  layer.replaceChildren(fragment);
}
function placeOverlay(el,node,preferRight=false){
  const mr=map.getBoundingClientRect(),br=el.getBoundingClientRect();
  const width= Math.min(preferRight?295:300,mr.width-20);
  let x=br.left-mr.left+br.width/2+12;
  if(x+width>mr.width-8)x=Math.max(8,br.left-mr.left-width-12);
  let y=br.top-mr.top+br.height+8;
  const maxH=Math.min(preferRight?350:190,mr.height*.65);
  if(y+maxH>mr.height-8)y=Math.max(8,br.top-mr.top-maxH-6);
  node.style.left=x+'px';node.style.top=y+'px';
}
function hidePreview(){preview.hidden=true}
function showPreview(el,items){if(!picker.hidden)return;const e=items[0];
  if(items.length===1){preview.innerHTML=`<div class="preview-title">${esc(e.n)}</div><div class="preview-meta">${e.k==='b'?'異獸神禽':'異人邦國'} · 〈${esc(e.s)}〉${e.pl?' · '+esc(e.pl):''}</div><div class="preview-quote">${esc(e.t)}</div><div class="preview-foot">點擊後在右側閱讀全文</div>`}
  else{preview.innerHTML=`<div class="preview-title">此處有 ${items.length} 條記載</div><div class="preview-meta">${esc([...new Set(items.map(x=>x.s))].join('、'))}</div><div class="preview-quote">${esc(items.slice(0,4).map(x=>x.n).join('、'))}${items.length>4?'……':''}</div><div class="preview-foot">點擊展開條目清單</div>`}
  preview.hidden=false;placeOverlay(el,preview)
}
function closePicker(){picker.hidden=true;picker.replaceChildren()}
function openPicker(el,items){
  closePicker();const ordered=[...items].sort((a,b)=>ORDER.indexOf(a.s)-ORDER.indexOf(b.s)||ALL.indexOf(a)-ALL.indexOf(b));
  picker.innerHTML=`<div class="picker-head"><span>選擇條目 · ${ordered.length}條</span><button class="picker-close" type="button" aria-label="關閉選單">×</button></div>`+
    ordered.map(e=>`<button class="picker-item" type="button" data-id="${esc(e.id)}">${esc(e.n)}<small>〈${esc(e.s)}〉${e.pl?' · '+esc(e.pl):''}</small></button>`).join('');
  picker.hidden=false;placeOverlay(el,picker,true);
  picker.querySelector('.picker-close').addEventListener('click',closePicker);
  picker.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>{const e=byId[b.dataset.id];closePicker();selectOnMap(e)}));
  picker.querySelector('.picker-close').focus();
}
map.addEventListener('click',ev=>{if(!ev.target.closest('.dot,.marker-picker'))closePicker()});
function mapFilter(){queueMarkers()}
['cb','cp','sec'].forEach(id=>$(id).addEventListener('change',mapFilter));$('q').addEventListener('input',mapFilter);
function selectOnMap(e,center){
  sel=e;
  const ch=$('sec').value;
  mdet.innerHTML=(ch?`<button type="button" class="back-chapter" data-back-chapter>← 返回〈${esc(ch)}〉介紹</button>`:'')+detailHTML(e,false);
  mdet.scrollTop=0;
  if(center){const r=map.getBoundingClientRect();if(s<1.4)s=Math.max(minS(),1.8);animateStage();tx=r.width/2-e.px*s;ty=r.height/2-e.py*s;apply()}
  queueMarkers();
}

/* ===== 經卷導覽軸：以文本篇章為序，與原本篇章下拉選單同步 ===== */
const CHAPTERS=['',...ORDER.filter(ch=>ALL.some(e=>e.s===ch))];
rail.innerHTML=CHAPTERS.map((ch,i)=>{const count=ch?ALL.filter(e=>e.s===ch).length:ALL.length;return `<button type="button" class="chapter-unit${i===0?' active':''}" data-chapter="${esc(ch)}" aria-pressed="${i===0}" title="${ch||'全部篇章'}"><strong>${ch||'全部篇章'}</strong><small>${count} 條 · ${i===0?'查看全圖':'按篇章探索'}</small></button>`}).join('');
const chapterBtns=[...rail.querySelectorAll('.chapter-unit')];
let suppressScroll=false,scrollTimer=null,unlockTimer=null;
function updateRail(ch,smooth=true){
  chapterBtns.forEach(b=>{const on=b.dataset.chapter===ch;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
  const b=chapterBtns.find(b=>b.dataset.chapter===ch);if(!b)return;
  const rr=rail.getBoundingClientRect(),br=b.getBoundingClientRect();const anchor=chapterBtns[0].getBoundingClientRect().width/2;const left=rail.scrollLeft+(br.left-rr.left)+br.width/2-anchor;
  suppressScroll=true;clearTimeout(unlockTimer);rail.scrollTo({left,behavior:smooth?'smooth':'instant'});
  unlockTimer=setTimeout(()=>{suppressScroll=false},smooth?650:90);
}
function chooseChapter(ch,{fromRail=false,focus=true}={}){
  if($('sec').value!==ch)$('sec').value=ch;
  if(!fromRail)updateRail(ch);
  else chapterBtns.forEach(b=>{const on=b.dataset.chapter===ch;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
  $('chapter-announcement').textContent=ch?`已切換至${ch}`:'已切換至全部篇章';
  showChapterIntro(ch);
  hidePreview();closePicker();mapFilter();
  if(focus){const items=ALL.filter(e=>e.px!==undefined&&eligible(e));ch?focusRecords(items):fit()}
}
$('sec').addEventListener('change',()=>chooseChapter($('sec').value));
rail.addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(!b||rail.dataset.wasDragged==='1')return;chooseChapter(b.dataset.chapter)});
function nearestChapter(){const r=rail.getBoundingClientRect();const center=r.left+chapterBtns[0].getBoundingClientRect().width/2;let closest=chapterBtns[0],best=Infinity;
  chapterBtns.forEach(b=>{const q=b.getBoundingClientRect(),d=Math.abs(q.left+q.width/2-center);if(d<best){best=d;closest=b}});return closest.dataset.chapter}
rail.addEventListener('scroll',()=>{if(suppressScroll)return;clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(suppressScroll)return;const ch=nearestChapter();if(ch!==$('sec').value)chooseChapter(ch,{fromRail:true});},130)},{passive:true});
let drag=null;
rail.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;suppressScroll=false;clearTimeout(unlockTimer);drag={id:e.pointerId,x:e.clientX,left:rail.scrollLeft,moved:false};});
rail.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const d=e.clientX-drag.x;
  if(Math.abs(d)>5){drag.moved=true;rail.classList.add('dragging');try{rail.setPointerCapture(e.pointerId)}catch(_){}}
  if(drag.moved)rail.scrollLeft=drag.left-d;
});
function endRailDrag(e){if(!drag||drag.id!==e.pointerId)return;
  if(drag.moved){rail.dataset.wasDragged='1';setTimeout(()=>{rail.dataset.wasDragged='0'},100);const ch=nearestChapter();chooseChapter(ch,{fromRail:true});updateRail(ch)}
  rail.classList.remove('dragging');drag=null;
}
rail.addEventListener('pointerup',endRailDrag);rail.addEventListener('pointercancel',endRailDrag);
rail.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const i=CHAPTERS.indexOf($('sec').value);chooseChapter(CHAPTERS[Math.max(0,Math.min(CHAPTERS.length-1,i+(e.key==='ArrowRight'?1:-1)))])});
rail.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();rail.scrollLeft+=e.deltaY}},{passive:false});
// 返回全部篇章：重置篇章、搜尋及類型篩選，還原全圖與右側導覽說明。
$('chapter-focus').addEventListener('click',()=>{
  $('q').value='';
  $('cb').checked=true;
  $('cp').checked=true;
  chooseChapter('', {focus:true});
});
// 單獨點擊標記後可以返回目前經卷的文字介紹。
mdet.addEventListener('click',ev=>{if(ev.target.closest('[data-back-chapter]'))showChapterIntro($('sec').value)});
addEventListener('keydown',ev=>{if(ev.key==='Escape'){closePicker();hidePreview()}});
requestAnimationFrame(()=>updateRail('',false));

/* ---------- 圖鑑 ---------- */
function buildBook(k,fEl,gEl,cEl){
  const items=ALL.filter(e=>e.k===k);
  const groups=['全部',...ORDER.filter(s=>items.some(e=>e.s===s))];
  let cur='全部',q='';
  fEl.innerHTML=groups.map(g=>`<button class="fchip" aria-pressed="${g==='全部'}" data-g="${g}">${g}</button>`).join('')+
    `<input type="search" placeholder="搜尋" aria-label="搜尋">`;
  const draw=()=>{
    const list=items.filter(e=>(cur==='全部'||e.s===cur)&&(!q||e.n.includes(q)||e.a.includes(q)||e.t.includes(q)));
    cEl.textContent=`${list.length} 條`;
    gEl.innerHTML=list.map(e=>`<button class="card" data-id="${e.id}">${picHTML(e)}<div><b>${esc(e.n)}</b><small>〈${esc(e.s)}〉${e.pl?'　'+esc(e.pl):''}</small><span class="ex">${esc(e.t)}</span></div></button>`).join('');
  };
  fEl.addEventListener('click',ev=>{const b=ev.target.closest('.fchip');if(!b)return;cur=b.dataset.g;
    fEl.querySelectorAll('.fchip').forEach(x=>x.setAttribute('aria-pressed',x===b));draw()});
  fEl.querySelector('input').addEventListener('input',ev=>{q=ev.target.value.trim();draw()});
  gEl.addEventListener('click',ev=>{const c=ev.target.closest('.card');if(c)openDrawer(byId[c.dataset.id],c)});
  draw();
}
const drawer=$('drawer');let lastCard=null;
function openDrawer(e,from){lastCard=from;drawer.innerHTML=`<button class="close" aria-label="關閉">✕</button>`+detailHTML(e,true);
  drawer.classList.add('open');drawer.scrollTop=0;drawer.querySelector('.close').focus()}
function closeDrawer(){if(!drawer.classList.contains('open'))return;drawer.classList.remove('open');if(lastCard)lastCard.focus()}
drawer.addEventListener('click',ev=>{
  if(ev.target.closest('.close'))return closeDrawer();
  const g=ev.target.closest('[data-goto]');if(g){const e=byId[g.dataset.goto];drawer.classList.remove('open');location.hash='map';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!fitted)fit();$('q').value='';$('cb').checked=true;$('cp').checked=true;chooseChapter(e.s,{focus:false});selectOnMap(e,true)}))}});
addEventListener('keydown',ev=>{if(ev.key==='Escape')closeDrawer()});
buildBook('b',$('fb'),$('gb'),$('cbn'));buildBook('p',$('fp'),$('gp'),$('cpn'));

/* ---------- 頁面切換（網址 #map #beasts #people #about） ---------- */
const VIEWS=['classic','map','beasts','people','about'];
function route(){const h=location.hash.slice(1);return VIEWS.includes(h)?h:'map'}
function show(){
  const r=route();
  VIEWS.forEach(v=>$('v-'+v).classList.toggle('on',v===r));
  document.querySelectorAll('.links a').forEach(a=>{if(a.getAttribute('href')==='#'+r)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(r!=='map'&&r!=='beasts'&&r!=='people')closeDrawer();
  if(r==='map')requestAnimationFrame(()=>{fit();});
  scrollTo(0,0);
}
addEventListener('hashchange',show);
show();mapFilter();

window.__shjFit=fit;window.__shjShow=show;
/* 頁尾小功能：網址加 ?intro=1 可重看開場 */
})();
