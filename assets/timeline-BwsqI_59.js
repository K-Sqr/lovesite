import{n as e,t}from"./theme-vnjdJnDR.js";import{n,r,t as i}from"./loveCounter-DnUPHvg2.js";/* empty css                 */function a(){let e=document.getElementById(`timelineStats`);if(!e)return;let t=new Date(2025,8,13),n=new Date-t,i=Math.floor(n/(1e3*60*60*24));e.innerHTML=`
    <div class="stat-card reveal" data-delay="1">
      <div class="stat-number">${i}</div>
      <div class="stat-label">days together</div>
    </div>
    <div class="stat-card reveal" data-delay="2">
      <div class="stat-number">${Math.floor(i/30.44)}</div>
      <div class="stat-label">months</div>
    </div>
    <div class="stat-card reveal" data-delay="3">
      <div class="stat-number">${r.length}</div>
      <div class="stat-label">milestones</div>
    </div>
  `}function o(){let e=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&e.target.classList.add(`visible`)})},{threshold:.1,rootMargin:`0px 0px -30px 0px`});document.querySelectorAll(`.reveal`).forEach(t=>e.observe(t))}document.addEventListener(`DOMContentLoaded`,()=>{t(),e(),a(),n(!0),i(),requestAnimationFrame(()=>setTimeout(o,50))});