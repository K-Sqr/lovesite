import{i as e,o as t,s as n,t as r}from"./firebase-CAwez44M.js";var i=`https://lovegpt-osmy5pclpq-uc.a.run.app`;function a(){return!!r.currentUser}function o(){let e=r.currentUser?r.currentUser.uid:null;return e===`owner`||e===`tolu`?e:null}async function s(a){let o=await fetch(i,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({action:`verify-passcode`,passcode:a})});if(!o.ok)return!1;let s=await o.json();if(!s||!s.token)return!1;try{return await t(r,e),await n(r,s.token),!0}catch(e){return console.error(`Custom token sign-in failed:`,e),!1}}async function c(){return new Promise(e=>{let t=document.createElement(`div`);t.className=`passcode-overlay`,t.innerHTML=`
      <div class="passcode-modal">
        <h3>Enter Passcode</h3>
        <p>Enter your shared passcode to manage memories</p>
        <input type="password" class="passcode-input" placeholder="Passcode" autocomplete="off" />
        <div class="passcode-actions">
          <button type="button" class="passcode-cancel">Cancel</button>
          <button type="button" class="passcode-submit">Enter</button>
        </div>
        <p class="passcode-error" style="display:none">Wrong passcode</p>
      </div>
    `,document.body.appendChild(t),requestAnimationFrame(()=>t.classList.add(`active`));let n=t.querySelector(`.passcode-input`),r=t.querySelector(`.passcode-submit`),i=t.querySelector(`.passcode-cancel`),a=t.querySelector(`.passcode-error`),o=!1;n.focus();function c(n){o||(o=!0,t.classList.remove(`active`),setTimeout(()=>t.remove(),300),e(n))}async function l(){let e=n.value.trim();if(!e){a.textContent=`Please enter a passcode`,a.style.display=`block`,n.focus();return}r.disabled=!0;let t=await s(e);if(r.disabled=!1,!t){a.style.display=`block`,a.textContent=`Wrong passcode`,n.focus();return}c(!0)}r.addEventListener(`click`,l),i.addEventListener(`click`,()=>c(null)),n.addEventListener(`keydown`,e=>{e.key===`Enter`&&l(),e.key===`Escape`&&c(null)}),t.addEventListener(`click`,e=>{e.target===t&&c(null)})})}async function l(){return a()?!0:await c()===!0}export{l as n,o as r,s as t};