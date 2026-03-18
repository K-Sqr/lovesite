const SESSION_KEY = 'aho_auth';

async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getStoredHash() {
  return sessionStorage.getItem(SESSION_KEY);
}

export async function authenticate(passcode) {
  const hash = await hashPasscode(passcode);
  sessionStorage.setItem(SESSION_KEY, hash);
  return hash;
}

export function isAuthenticated() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

export function clearAuth() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function showPasscodeModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'passcode-overlay';
    overlay.innerHTML = `
      <div class="passcode-modal">
        <h3>Enter Passcode</h3>
        <p>Enter your shared passcode to upload memories</p>
        <input type="password" class="passcode-input" placeholder="Passcode" autocomplete="off" />
        <div class="passcode-actions">
          <button class="passcode-cancel">Cancel</button>
          <button class="passcode-submit">Enter</button>
        </div>
        <p class="passcode-error" style="display:none">Please enter a passcode</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const input = overlay.querySelector('.passcode-input');
    const submitBtn = overlay.querySelector('.passcode-submit');
    const cancelBtn = overlay.querySelector('.passcode-cancel');
    const errorMsg = overlay.querySelector('.passcode-error');

    input.focus();

    function close(result) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    }

    async function submit() {
      const val = input.value.trim();
      if (!val) {
        errorMsg.style.display = 'block';
        input.focus();
        return;
      }
      const hash = await authenticate(val);
      close(hash);
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
