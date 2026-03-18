import"./sections-DM2VKbvV.js";import{n as e,t}from"./timeline-CNc_2XC8.js";/* empty css                 */function n(){let t=document.getElementById(`timelineStats`);if(!t)return;let n=new Date(2025,8,13),r=new Date-n,i=Math.floor(r/(1e3*60*60*24));t.innerHTML=`
    <div class="stat-card reveal" data-delay="1">
      <div class="stat-number">${i}</div>
      <div class="stat-label">days together</div>
    </div>
    <div class="stat-card reveal" data-delay="2">
      <div class="stat-number">${Math.floor(i/30.44)}</div>
      <div class="stat-label">months</div>
    </div>
    <div class="stat-card reveal" data-delay="3">
      <div class="stat-number">${e.length}</div>
      <div class="stat-label">milestones</div>
    </div>
  `}function r(){let e=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&e.target.classList.add(`visible`)})},{threshold:.1,rootMargin:`0px 0px -30px 0px`});document.querySelectorAll(`.reveal`).forEach(t=>e.observe(t))}document.addEventListener(`DOMContentLoaded`,()=>{n(),t(!0),requestAnimationFrame(()=>setTimeout(r,50))});