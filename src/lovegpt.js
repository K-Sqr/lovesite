import './styles/base.css';
import './styles/sections.css';
import './styles/lovegpt.css';
import { initNavbar } from './modules/navbar.js';
import { initTheme } from './modules/theme.js';

const FUNCTION_URL = 'https://us-central1-lovesite-1540e.cloudfunctions.net/lovegpt';

const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const starters = document.getElementById('starters');

let history = [];
let isLoading = false;

function formatReply(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function addMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '\u{1F496}' : '\u{2728}';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = formatReply(content);
  } else {
    bubble.textContent = content;
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;

  return wrapper;
}

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-msg assistant';
  wrapper.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '\u{2728}';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage(text) {
  if (!text.trim() || isLoading) return;

  isLoading = true;
  sendBtn.disabled = true;
  chatInput.value = '';

  if (!starters.classList.contains('hidden')) {
    starters.classList.add('hidden');
  }

  addMessage('user', text);
  showTyping();

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    hideTyping();

    addMessage('assistant', data.reply);

    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: data.reply });

    if (history.length > 20) {
      history = history.slice(-16);
    }
  } catch (err) {
    hideTyping();
    addMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment.");
    console.error('LoveGPT fetch error:', err);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();

  sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  starters.querySelectorAll('.starter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.dataset.q;
      sendMessage(q);
    });
  });
});
