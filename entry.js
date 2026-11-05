(function(){
/* ---------- 開場「入山」後：雲霧散開，露出地圖 ---------- */
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const c=document.getElementById('clouds');
function cover(){
  if(reduce)return;
  c.classList.remove('gone','part');
  if(location.hash&&location.hash!=='#map'){history.replaceState(null,'','#map');window.__shjShow();}
  addEventListener('shanhai:enter',()=>{window.__shjFit();requestAnimationFrame(()=>requestAnimationFrame(()=>c.classList.add('part')));setTimeout(()=>c.classList.add('gone'),2800)},{once:true});
}
if(document.getElementById('shanhai-intro'))cover();
document.getElementById('replay').addEventListener('click',()=>{if(document.getElementById('shanhai-intro')||!window.SHANHAI_REPLAY)return;cover();window.SHANHAI_REPLAY();});
})();
