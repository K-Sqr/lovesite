import{n as e,r as t,t as n}from"./theme-B-Ckcky0.js";import{n as r,r as i,t as a}from"./loveCounter-8KZ_Jv1S.js";/* empty css                 */function o(){let e=document.getElementById(`timelineStats`);if(!e)return;let t=new Date(2025,8,13),n=new Date-t,r=Math.floor(n/(1e3*60*60*24));e.innerHTML=`
    <div class="stat-card reveal" data-delay="1">
      <div class="stat-number">${r}</div>
      <div class="stat-label">days together</div>
    </div>
    <div class="stat-card reveal" data-delay="2">
      <div class="stat-number">${Math.floor(r/30.44)}</div>
      <div class="stat-label">months</div>
    </div>
    <div class="stat-card reveal" data-delay="3">
      <div class="stat-number">${i.length}</div>
      <div class="stat-label">milestones</div>
    </div>
  `}function s(){let e=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&e.target.classList.add(`visible`)})},{threshold:.1,rootMargin:`0px 0px -30px 0px`});document.querySelectorAll(`.reveal`).forEach(t=>e.observe(t))}document.addEventListener(`DOMContentLoaded`,()=>{n(),e(),o(),r(!0),a(),t(),requestAnimationFrame(()=>setTimeout(s,50))});