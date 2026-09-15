import './styles/base.css';
import './styles/sections.css';
import './styles/lovegpt.css';
import { initSiteChrome } from './modules/siteChrome.js';

const FUNCTION_URL = 'https://lovegpt-osmy5pclpq-uc.a.run.app';

const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const starters = document.getElementById('starters');
const starterPills = document.getElementById('starterPills');
const shuffleBtn = document.getElementById('shuffleBtn');
const surpriseBtn = document.getElementById('surpriseBtn');
const suggestBar = document.getElementById('suggestBar');
const suggestPills = document.getElementById('suggestPills');
const suggestMore = document.getElementById('suggestMore');

let history = [];
let isLoading = false;

/**
 * Question pool. `q` is what gets sent; `label` is the pill text.
 * Grouped loosely so a shuffle tends to pull a mix rather than eight of the same kind.
 */
const QUESTION_POOL = [
  // Us — story & dates
  { e: '\u{1F4D6}', label: 'How did Emmanuel ask Tolu out?', q: 'How did Emmanuel ask Tolu out?' },
  { e: '\u{1F4F1}', label: 'Remind us of our first date', q: 'Remind us of our first virtual date' },
  { e: '\u{1F5D3}', label: 'What happened in June?', q: 'What happened for us in June 2026?' },
  { e: '\u{1F342}', label: 'How was October for us?', q: 'How was October 2025 for us?' },
  { e: '\u{2744}', label: 'What was Winnipeg like?', q: 'What did we do together in Winnipeg in February?' },
  { e: '\u{1F48D}', label: 'When is our wedding date?', q: 'When is our anticipated wedding date, and who is first on the guest list?' },
  { e: '\u{1F4DC}', label: "What are Emmanuel's promises?", q: "What are Emmanuel's promises to Tolu?" },
  { e: '\u{1F917}', label: 'What did she write about meeting me?', q: 'What did Tolu write about meeting me in person?' },
  { e: '\u{1F4AC}', label: 'What did she say at her graduation?', q: 'What did Tolu say to Emmanuel on her graduation day?' },
  { e: '\u{1F333}', label: 'Why is a tree her symbol?', q: "Why is a tree Tolu's symbol?" },

  // Her — tastes & details
  { e: '\u{1F35F}', label: 'What does she like to eat?', q: 'What does Tolu like to eat?' },
  { e: '\u{1F3AC}', label: 'Her favourite shows and genres?', q: "What are Tolu's favourite movies, shows and genres?" },
  { e: '\u{1F4DA}', label: 'Her favourite books?', q: "What are Tolu's favourite books and anime?" },
  { e: '\u{1F5E3}', label: 'What are her catchphrases?', q: 'What phrases does Tolu say all the time?' },
  { e: '\u{1F381}', label: 'What should I get her?', q: 'What gift should I get Tolu next?' },
  { e: '\u{1F3A8}', label: 'What colours does she like to wear?', q: 'What colours and styles does Tolu like to wear, and what should I avoid buying?' },
  { e: '\u{2708}', label: 'Where does she want to travel?', q: 'Where does Tolu want to travel?' },
  { e: '\u{1F4A1}', label: 'What are her big dreams?', q: "What are Tolu's big dreams and what does she want to build?" },
  { e: '\u{1F48C}', label: 'What is her love language?', q: "What is Tolu's love language and how do I speak it?" },
  { e: '\u{1F9E0}', label: 'What does she want to work on?', q: 'What has Tolu said she wants to work on, and how can I support her?' },

  // Outfits
  { e: '\u{1F457}', label: 'What should she wear on a date?', q: 'Suggest a date-night outfit for Tolu from her closet' },
  { e: '\u{26EA}', label: 'Church outfit idea', q: 'What should Tolu wear to church this Sunday?' },
  { e: '\u{1F4BC}', label: 'Interview outfit', q: 'What should Tolu wear to a job interview?' },
  { e: '\u{1F9E5}', label: "What's missing from her closet?", q: "What pieces is Tolu's closet missing that I could buy her?" },
  { e: '\u{1F3E0}', label: 'Cosy FaceTime-date fit', q: 'What should Tolu wear for a cosy FaceTime date tonight?' },

  // Do together
  { e: '\u{1F37F}', label: 'Suggest a date night idea', q: 'Suggest a date night idea for tonight' },
  { e: '\u{1F3AE}', label: "We're tired — what game?", q: "We're both tired tonight. What game should we play?" },
  { e: '\u{1F4FA}', label: 'What should we watch?', q: 'What should we watch together this week?' },
  { e: '\u{1F64F}', label: 'How can we pray together this week?', q: 'Suggest a way for us to pray or do a devotional together this week' },
  { e: '\u{26BD}', label: 'What football team do we support?', q: 'What football team do we support?' },
  { e: '\u{1F4D6}', label: 'What book are we reading?', q: 'What book are we reading together right now?' },
  { e: '\u{1F5FA}', label: 'Plan a weekend for us', q: 'Plan a long-distance weekend for us with one anchor date and one mini-date' },
  { e: '\u{1F3AF}', label: 'Pick a debate topic', q: 'Pick a debate topic for us tonight and give each side an opening line' },

  // Feelings & faith
  { e: '\u{1F49E}', label: 'Write her a good-morning text', q: 'Write Tolu a short good-morning text in my voice' },
  { e: '\u{1F31F}', label: 'Remind me why I love her', q: 'Remind me why I love Tolu' },
  { e: '\u{1F4AA}', label: 'She had a hard day — help', q: 'Tolu had a hard day. How do I show up for her tonight?' },
  { e: '\u{1F4A5}', label: 'We had a disagreement', q: 'We had a disagreement. How should we handle it, in our way?' },
  { e: '\u{1F54A}', label: 'What are our family vows?', q: 'What are our family vows?' },
  { e: '\u{1F91D}', label: 'What are we good at as a couple?', q: 'What are the best attributes of our relationship?' },
  { e: '\u{1F60F}', label: 'Give me a pickup line', q: 'Give me one of my pickup lines to send her right now' },
];

const STARTER_COUNT = 8;
const SUGGEST_COUNT = 3;

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Skip anything already asked this session so the row always offers something new. */
const asked = new Set();

function pickQuestions(n) {
  const fresh = QUESTION_POOL.filter(item => !asked.has(item.q));
  return shuffled(fresh.length >= n ? fresh : QUESTION_POOL).slice(0, n);
}

function makePill(item, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = `${item.e} ${item.label}`;
  btn.addEventListener('click', () => sendMessage(item.q));
  return btn;
}

function renderStarters() {
  starterPills.replaceChildren(...pickQuestions(STARTER_COUNT).map(item => makePill(item, 'starter-pill')));
}

function renderSuggestions() {
  suggestPills.replaceChildren(...pickQuestions(SUGGEST_COUNT).map(item => makePill(item, 'suggest-pill')));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatReply(text) {
  const escaped = escapeHtml(text);
  return escaped
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
    suggestBar.hidden = false;
  }
  renderSuggestions();

  asked.add(text);
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
  initSiteChrome({ active: 'lovegpt' });

  sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  renderStarters();
  shuffleBtn.addEventListener('click', renderStarters);
  surpriseBtn.addEventListener('click', () => sendMessage(pickQuestions(1)[0].q));
  suggestMore.addEventListener('click', renderSuggestions);
});
