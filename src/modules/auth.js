import { auth } from './firebase.js';
import { setPersistence, signInWithCustomToken, browserSessionPersistence } from 'firebase/auth';

// Reuse the LoveGPT Cloud Function URL.
// It now supports `action: "verify-passcode"` for secure admin actions.
const FUNCTION_URL = 'https://lovegpt-osmy5pclpq-uc.a.run.app';

export function isAuthenticated() {
  return !!auth.currentUser;
}

export async function authenticateWithPasscode(passcode) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-passcode', passcode }),
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  if (!data || !data.token) return false;

  // Keep auth scoped to this browser session.
  await setPersistence(auth, browserSessionPersistence);
  await signInWithCustomToken(auth, data.token);
  return true;
}

export async function showPasscodeModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'passcode-overlay';
    overlay.innerHTML = `
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
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const input = overlay.querySelector('.passcode-input');
    const submitBtn = overlay.querySelector('.passcode-submit');
    const cancelBtn = overlay.querySelector('.passcode-cancel');
    const errorMsg = overlay.querySelector('.passcode-error');

    let closed = false;
    input.focus();

    function close(result) {
      if (closed) return;
      closed = true;
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    }

    async function submit() {
      const passcode = input.value.trim();
      if (!passcode) {
        errorMsg.textContent = 'Please enter a passcode';
        errorMsg.style.display = 'block';
        input.focus();
        return;
      }

      submitBtn.disabled = true;
      const ok = await authenticateWithPasscode(passcode);
      submitBtn.disabled = false;

      if (!ok) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Wrong passcode';
        input.focus();
        return;
      }

      close(true);
    }

    submitBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close(null);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

export async function ensureAuthenticated() {
  if (isAuthenticated()) return true;
  const ok = await showPasscodeModal();
  return ok === true;
}
