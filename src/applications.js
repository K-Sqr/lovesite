import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/applications.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal, observeReveal } from './modules/reveal.js';
import { openModal, closeModal } from './modules/modal.js';
import { formatRelativeGentle, formatLongDate, parseISO, daysBetween } from './modules/dates.js';
import {
  STATUSES, STATUS_TONE, MATERIAL_KINDS, KIND_ORDER, kindLabel, isArchived,
  listMaterials, addMaterial, updateMaterial, deleteMaterial, duplicateMaterial,
  getTemplateOverrides, setTemplateOverride, resetTemplateOverride,
  listApplications, getApplication, addApplication, updateApplication, deleteApplication,
  orderForAttention, nextAttention,
  exportAll, importAll, backupFilename,
  subscribeApplications, subscribeMaterials, onSaveFailure,
} from './modules/applicationsStore.js';
import { promptTemplates, getTemplate, DEFAULT_KINDS_BY_TEMPLATE, TONES } from './data/promptTemplates.js';
import { mountReminderStrip } from './modules/reminderUI.js';

/**
 * The Application Desk — page entry.
 *
 * Renders and wires events only. Every read and write goes through
 * applicationsStore.js; this file never touches browser storage directly, and
 * stored text (job descriptions are pasted from the open web) only ever
 * reaches the DOM through textContent or a control's value. No network.
 */

/** One small helper — the only place this file talks to the console. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[applications] ${message}`, err);
  else console.warn(`[applications] ${message}`);
}

const $ = (id) => document.getElementById(id);

function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
  wrapped.flush = (...args) => { if (t !== null) { clearTimeout(t); t = null; fn(...args); } };
  wrapped.cancel = () => { clearTimeout(t); t = null; };
  return wrapped;
}

/** createElement + textContent, in the house style of renderMemoryCard(). */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isPhone() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 600px)').matches;
}

document.addEventListener('DOMContentLoaded', () => {
  // The chrome reads browser storage without a guard (theme.js); if storage is
  // blocked it must not take the desk down with it.
  try {
    initSiteChrome({ active: 'foryou' });
  } catch (err) {
    warn('site chrome failed to initialise; continuing without it', err);
  }

  mountReminderStrip('#deskReminders', { types: ['application'] });

  /* ─────────────────────────────── state ─────────────────────────────── */

  let materialsCache = listMaterials();
  let templateOverrides = getTemplateOverrides();
  let currentTemplateId = promptTemplates[0].id;
  let currentTone = TONES[0];
  /** Material ids ticked in the assembler. */
  const checkedMaterials = new Set();
  /** Ids she has already had defaults applied to, so a re-render never re-ticks what she unticked. */
  const seenInPicker = new Set();
  /** The record the assembler is editing (set by "Prepare this one"); null for a fresh prompt. */
  let assemblerAppId = null;
  /** Material rows currently expanded (survive re-renders). */
  const expandedMaterials = new Set();
  /** Rows already revealed once; re-renders must not re-animate them. */
  const shownRows = new Set();
  let openDetailId = null;
  /** Where focus goes when the panel closes: the row's main button, looked up fresh (rows re-render). */
  let detailReturnFocus = null;
  let menuReturnFocus = null;

  /* ───────────────────────────── feedback ───────────────────────────── */

  const liveStatus = $('liveStatus');
  function announce(text) {
    // Clear then set so the same message is announced twice in a row if needed.
    liveStatus.textContent = '';
    requestAnimationFrame(() => { liveStatus.textContent = text; });
  }

  let toastEl = null;
  let toastTimer = null;
  function showToast(text, { sticky = false } = {}) {
    if (!toastEl) {
      toastEl = el('div', { class: 'usm-toast', role: 'status' }, [el('div', { class: 'usm-toast__card' })]);
      document.body.appendChild(toastEl);
    }
    const card = toastEl.firstElementChild;
    card.replaceChildren(el('span', { text }));
    if (sticky) {
      const close = el('button', { type: 'button', class: 'usm-toast__close', 'aria-label': 'Dismiss', text: '×' });
      close.addEventListener('click', hideToast);
      card.appendChild(close);
    }
    clearTimeout(toastTimer);
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('is-open'));
    if (!sticky) toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove('is-open');
    clearTimeout(toastTimer);
  }

  let storageToastShown = false;
  onSaveFailure(() => {
    if (storageToastShown) return;
    storageToastShown = true;
    // storage.js already raised its own calm banner for this; one is enough.
    if (document.querySelector('.usm-banner')) return;
    showToast("Saving isn't working in this browser right now. Copy anything you want to keep.", { sticky: true });
  });

  const confirmModal = $('confirmModal');
  const confirmTitle = $('confirmTitle');
  const confirmBody = $('confirmBody');
  const confirmOk = $('confirmOk');
  /** @returns {Promise<boolean>} */
  function confirmDialog({ title, body, okLabel = 'Yes' }) {
    return new Promise((resolve) => {
      confirmTitle.textContent = title;
      confirmBody.textContent = body;
      confirmOk.textContent = okLabel;
      let decided = false;
      const onOk = () => { decided = true; confirmOk.removeEventListener('click', onOk); closeModal(confirmModal); };
      confirmOk.addEventListener('click', onOk);
      openModal(confirmModal, {
        initialFocus: confirmOk,
        onClose: () => { confirmOk.removeEventListener('click', onOk); resolve(decided); },
      });
    });
  }

  /* ────────────────────────────── tabs ────────────────────────────── */

  const TAB_NAMES = ['prepare', 'materials', 'applications'];
  const tabs = TAB_NAMES.map((n) => $(`tab-${n}`));
  const panels = TAB_NAMES.map((n) => $(`panel-${n}`));

  function currentTab() {
    return TAB_NAMES[tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')] || 'prepare';
  }

  function selectTab(name, { focus = false, hash = true } = {}) {
    const idx = Math.max(0, TAB_NAMES.indexOf(name));
    tabs.forEach((tab, i) => {
      const on = i === idx;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[idx].focus();
    if (hash && TAB_NAMES[idx] !== 'prepare') history.replaceState(null, '', `#${TAB_NAMES[idx]}`);
    else if (hash) history.replaceState(null, '', location.pathname + location.search);
    if (TAB_NAMES[idx] !== 'applications') closeMenu();
    requestAnimationFrame(() => initReveal(panels[idx]));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(TAB_NAMES[i]));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      selectTab(TAB_NAMES[next], { focus: true });
    });
  });

  /* ─────────────────────────── the assembler ─────────────────────────── */

  const prepareForm = $('prepareForm');
  const jdInput = $('jobDescription');
  const orgInput = $('organization');
  const posInput = $('position');
  const urlInput = $('url');
  const deadlineInput = $('deadline');
  const templatePills = $('templatePills');
  const tonePills = $('tonePills');
  const lengthSelect = $('lengthSelect');
  const constraintsGroup = $('constraintsGroup');
  const materialsPicker = $('materialsPicker');
  const preview = $('promptPreview');
  const promptCount = $('promptCount');
  const copyBtn = $('copyBtn');
  const copyHint = $('copyHint');
  const saveToAppsBtn = $('saveToAppsBtn');
  const prepareEmpty = $('prepareEmpty');
  const templateEditor = $('templateEditor');
  const templateBody = $('templateBody');
  const templateSummary = templateEditor.querySelector('summary');

  function renderPillGroup(container, items, selectedId, onPick) {
    container.replaceChildren(...items.map((item) => {
      const on = item.id === selectedId;
      const pill = el('button', {
        type: 'button',
        class: on ? 'usm-pill is-selected' : 'usm-pill',
        role: 'radio',
        'aria-checked': on ? 'true' : 'false',
        tabindex: on ? 0 : -1,
        'data-id': item.id,
        text: item.label,
      });
      pill.addEventListener('click', () => onPick(item.id));
      pill.addEventListener('keydown', (e) => {
        const idx = items.findIndex((x) => x.id === item.id);
        let next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
        if (next === null) return;
        e.preventDefault();
        onPick(items[next].id);
        container.querySelector(`[data-id="${items[next].id}"]`)?.focus();
      });
      return pill;
    }));
  }

  function setTemplate(id, { applyDefaults = true } = {}) {
    currentTemplateId = id;
    renderPillGroup(templatePills, promptTemplates, id, (picked) => setTemplate(picked));
    // The references prompt has no tone or length rules to fill in.
    constraintsGroup.hidden = id === 'references';
    if (applyDefaults) {
      const kinds = DEFAULT_KINDS_BY_TEMPLATE[id] || [];
      checkedMaterials.clear();
      for (const m of materialsCache) if (kinds.includes(m.kind)) checkedMaterials.add(m.id);
      seenInPicker.clear();
      for (const m of materialsCache) seenInPicker.add(m.id);
    }
    renderPicker();
    refreshTemplateEditor();
    renderPreviewNow();
  }

  function setTone(id) {
    currentTone = TONES.find((t) => t.id === id) || TONES[0];
    renderPillGroup(tonePills, TONES, currentTone.id, setTone);
    renderPreviewNow();
  }

  function renderPicker() {
    const defaults = DEFAULT_KINDS_BY_TEMPLATE[currentTemplateId] || [];
    // Anything new since the last render gets the template's default tick.
    for (const m of materialsCache) {
      if (!seenInPicker.has(m.id)) {
        seenInPicker.add(m.id);
        if (defaults.includes(m.kind)) checkedMaterials.add(m.id);
      }
    }
    for (const id of Array.from(checkedMaterials)) {
      if (!materialsCache.some((m) => m.id === id)) checkedMaterials.delete(id);
    }

    if (materialsCache.length === 0) {
      const go = el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Add your resume under Materials' });
      go.addEventListener('click', () => { selectTab('materials'); openMaterialForm(); });
      materialsPicker.replaceChildren(
        el('p', { class: 'picker-empty', text: 'Nothing saved yet — the first one is usually your resume.' }),
        go,
      );
      return;
    }

    const groups = KIND_ORDER
      .map((kind) => ({ kind, items: materialsCache.filter((m) => m.kind === kind) }))
      .filter((g) => g.items.length > 0);

    materialsPicker.replaceChildren(...groups.map((g) => el('div', { class: 'picker-group' }, [
      el('p', { class: 'picker-group__kind', text: kindLabel(g.kind) }),
      ...g.items.map((m) => {
        const input = el('input', { type: 'checkbox', id: `pick-${m.id}`, 'data-id': m.id });
        input.checked = checkedMaterials.has(m.id);
        input.addEventListener('change', () => {
          if (input.checked) checkedMaterials.add(m.id); else checkedMaterials.delete(m.id);
          renderPreviewNow();
        });
        return el('label', { class: 'picker-item', for: `pick-${m.id}` }, [
          input,
          el('span', { class: 'picker-item__label', text: m.label }),
        ]);
      }),
    ])));
  }

  /* — template editor — */
  function currentTemplateBody() {
    const tpl = getTemplate(currentTemplateId);
    const override = templateOverrides[tpl.id];
    return typeof override === 'string' ? override : tpl.body;
  }

  function refreshTemplateEditor() {
    const edited = typeof templateOverrides[currentTemplateId] === 'string';
    templateSummary.textContent = edited ? 'Edit this template (edited)' : 'Edit this template';
    templateBody.value = currentTemplateBody();
  }

  $('templateSave').addEventListener('click', () => {
    const tpl = getTemplate(currentTemplateId);
    if (templateBody.value === tpl.body) resetTemplateOverride(tpl.id);
    else setTemplateOverride(tpl.id, templateBody.value);
    templateOverrides = getTemplateOverrides();
    refreshTemplateEditor();
    renderPreviewNow();
    showToast('Template saved.');
  });

  $('templateReset').addEventListener('click', () => {
    resetTemplateOverride(currentTemplateId);
    templateOverrides = getTemplateOverrides();
    refreshTemplateEditor();
    renderPreviewNow();
    showToast('Back to the default.');
  });

  /* — prompt assembly — */

  const KIND_WORDS = {
    resume: /\b(resume|r[ée]sum[ée]|cv)\b/i,
    blurb: /\b(note|experience)\b/i,
    coverLetter: /\bcover\b/i,
    references: /\breferences?\b/i,
    other: /$^/,
  };

  function materialHeading(m) {
    const kind = MATERIAL_KINDS.find((k) => k.id === m.kind) || MATERIAL_KINDS[MATERIAL_KINDS.length - 1];
    const label = m.label.trim();
    if (KIND_WORDS[kind.id].test(label)) return label;
    return `${kind.heading} — ${label}`;
  }

  /** Labelled, fenced sections in a stable order: resume, blurbs, cover letters, references. */
  function buildMaterialsBlock() {
    const chosen = materialsCache
      .filter((m) => checkedMaterials.has(m.id))
      .sort((a, b) => (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) || a.label.localeCompare(b.label));
    return chosen.map((m) => `### ${materialHeading(m)}\n"""\n${m.body.trim()}\n"""`).join('\n\n');
  }

  /**
   * Interpolate `{{token}}` from a flat context. Structure comes from the
   * template only: it is split into `## ` sections BEFORE any user text is
   * substituted, so nothing in a pasted posting can add or remove a section.
   * A line that held only empty tokens is dropped; a section whose body is
   * blank (fences aside) is dropped with its heading.
   */
  function renderTemplate(body, ctx) {
    const EMPTY = '\u0000'; // sentinel for an empty token; never survives to the output
    const value = (key) => {
      const v = ctx[key];
      return v === null || v === undefined || String(v).trim() === '' ? EMPTY : String(v);
    };
    const interpolateLine = (line) => {
      let out = line.replace(/\{\{\s*position\s*\}\}\s+at\s+\{\{\s*organization\s*\}\}/g, () => {
        const p = value('position');
        const o = value('organization');
        if (p !== EMPTY && o !== EMPTY) return `${p} at ${o}`;
        return p !== EMPTY ? p : o;
      });
      out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => value(key));
      if (out.includes(EMPTY)) {
        const rest = out.split(EMPTY).join('');
        if (rest.trim() === '') return null; // only empty tokens lived here
        return rest;
      }
      return out;
    };

    const sections = [];
    let current = { heading: null, lines: [] };
    for (const line of body.split('\n')) {
      if (/^##\s/.test(line)) {
        sections.push(current);
        current = { heading: line, lines: [] };
      } else {
        current.lines.push(line);
      }
    }
    sections.push(current);

    const out = [];
    for (const sec of sections) {
      const rendered = sec.lines.map(interpolateLine).filter((l) => l !== null);
      if (sec.heading === null) { out.push(...rendered); continue; }
      const meaningful = rendered.some((l) => l.trim() !== '' && l.trim() !== '"""');
      if (!meaningful) continue;
      out.push(sec.heading, ...rendered);
    }
    return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  }

  function assemblerFields() {
    return {
      jobDescription: jdInput.value,
      organization: orgInput.value.trim(),
      position: posInput.value.trim(),
      url: urlInput.value.trim(),
      deadline: deadlineInput.value || null,
    };
  }

  function buildPrompt() {
    const f = assemblerFields();
    const ctx = {
      position: f.position,
      organization: f.organization,
      url: f.url,
      jobDescription: f.jobDescription.trim(),
      materials: buildMaterialsBlock(),
      'constraints.tone': currentTone.value,
      'constraints.length': lengthSelect.value,
    };
    return renderTemplate(currentTemplateBody(), ctx);
  }

  const LONG_PROMPT = 60_000;
  function renderPreviewNow() {
    const text = buildPrompt();
    preview.textContent = text;
    const n = text.length;
    promptCount.textContent = n > LONG_PROMPT
      ? `${n.toLocaleString()} characters. This is a long prompt — Claude will handle it, but you may want to trim the older cover letters.`
      : `${n.toLocaleString()} characters`;
    prepareEmpty.hidden = jdInput.value.trim() !== '';
  }
  const renderPreview = debounce(renderPreviewNow, 200);

  prepareForm.addEventListener('input', renderPreview);
  prepareForm.addEventListener('change', renderPreview);
  prepareForm.addEventListener('submit', (e) => e.preventDefault());
  $('prepareEmptyBtn').addEventListener('click', () => jdInput.focus());

  /* — copy, with all three paths — */

  function copyViaExecCommand(text) {
    const ta = el('textarea', { class: 'copy-scratch', readonly: true, 'aria-hidden': 'true', tabindex: '-1' });
    ta.value = text;
    document.body.appendChild(ta);
    let ok = false;
    try {
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length); // iOS
      ok = document.execCommand && document.execCommand('copy');
    } catch (err) {
      warn('execCommand copy failed', err);
      ok = false;
    }
    ta.remove();
    return !!ok;
  }

  function selectPreviewText() {
    try {
      const range = document.createRange();
      range.selectNodeContents(preview);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      preview.focus({ preventScroll: true });
    } catch (err) {
      warn('could not select preview text', err);
    }
  }

  let copiedTimer = null;
  function confirmCopied() {
    copyBtn.textContent = 'Copied ✓';
    copyHint.textContent = 'Now paste it into Claude.';
    announce('Prompt copied.');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copyBtn.textContent = 'Copy prompt';
      copyHint.textContent = 'Ready when you are.';
    }, 2000);
  }

  copyBtn.addEventListener('click', () => {
    renderPreview.cancel();
    renderPreviewNow();
    const text = preview.textContent;
    const finish = (ok) => {
      if (ok) { confirmCopied(); return; }
      selectPreviewText();
      copyHint.textContent = 'Select all and copy — your browser blocked automatic copying.';
      announce('Automatic copying was blocked. The prompt text is selected — copy it yourself.');
    };
    // clipboard.writeText must be the first thing inside the tap on iOS Safari.
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => finish(true),
        (err) => { warn('clipboard.writeText rejected', err); finish(copyViaExecCommand(text)); },
      );
      return;
    }
    finish(copyViaExecCommand(text));
  });

  /* — the bridge to the tracker — */

  function firstChecked(kind) {
    const m = materialsCache.find((x) => x.kind === kind && checkedMaterials.has(x.id));
    return m ? m.id : null;
  }

  saveToAppsBtn.addEventListener('click', () => {
    const f = assemblerFields();
    if (!f.jobDescription.trim() && !f.organization && !f.position) {
      jdInput.focus();
      showToast('Paste the job description first, then save.');
      return;
    }
    const picks = { resumeUsed: firstChecked('resume'), coverLetter: firstChecked('coverLetter'), referencesUsed: firstChecked('references') };
    const existing = assemblerAppId ? getApplication(assemblerAppId) : null;
    if (existing) {
      const patch = { ...f, ...picks };
      if (existing.status === 'Saved') patch.status = 'Preparing';
      const { ok } = updateApplication(existing.id, patch);
      if (ok) showToast('Updated under Applications.'); // when saving fails, the storage banner speaks instead
      announce('Application updated.');
    } else {
      const { ok, item } = addApplication({ ...f, ...picks, status: 'Preparing' });
      assemblerAppId = item.id;
      if (ok) showToast('Saved under Applications.');
      announce('Application saved.');
    }
  });

  /** Fill the assembler from a record; "Save to applications" then updates it instead of duplicating. */
  function loadIntoAssembler(app) {
    assemblerAppId = app.id;
    jdInput.value = app.jobDescription || '';
    orgInput.value = app.organization || '';
    posInput.value = app.position || '';
    urlInput.value = app.url || '';
    deadlineInput.value = app.deadline || '';
    if (app.status === 'Saved') updateApplication(app.id, { status: 'Preparing' });
    setTemplate(currentTemplateId, { applyDefaults: true });
    for (const id of [app.resumeUsed, app.coverLetter, app.referencesUsed]) {
      if (id && materialsCache.some((m) => m.id === id)) checkedMaterials.add(id);
    }
    renderPicker();
    renderPreviewNow();
    selectTab('prepare');
    closeDetail({ restoreFocus: false });
    requestAnimationFrame(() => jdInput.focus({ preventScroll: false }));
  }

  /* ─────────────────────────── the materials library ─────────────────────────── */

  const materialForm = $('materialForm');
  const materialLabel = $('materialLabel');
  const materialKind = $('materialKind');
  const materialBody = $('materialBody');
  const addMaterialBtn = $('addMaterialBtn');
  const materialList = $('materialList');

  materialKind.replaceChildren(...MATERIAL_KINDS.map((k) => el('option', { value: k.id, text: k.label })));

  function openMaterialForm() {
    materialForm.classList.add('is-open');
    addMaterialBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => materialLabel.focus());
  }
  function closeMaterialForm() {
    materialForm.classList.remove('is-open');
    addMaterialBtn.setAttribute('aria-expanded', 'false');
  }

  addMaterialBtn.addEventListener('click', () => {
    if (materialForm.classList.contains('is-open')) closeMaterialForm(); else openMaterialForm();
  });
  $('materialCancelBtn').addEventListener('click', () => { closeMaterialForm(); addMaterialBtn.focus(); });

  materialForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = materialBody.value;
    if (!body.trim()) { materialBody.focus(); showToast('Paste the text in first.'); return; }
    const label = materialLabel.value.trim() || kindLabel(materialKind.value);
    const { ok } = addMaterial({ label, kind: materialKind.value, body });
    materialForm.reset();
    closeMaterialForm();
    if (ok) showToast('Saved. It will be here next time.');
    announce('Material saved.');
    addMaterialBtn.focus();
  });

  function renderMaterialRow(m, index) {
    const expanded = expandedMaterials.has(m.id);
    const row = el('article', { class: 'usm-card material-row reveal', 'data-delay': String((index % 4) + 1), 'data-id': m.id });

    const head = el('button', {
      type: 'button',
      class: 'material-row__head',
      'aria-expanded': expanded ? 'true' : 'false',
      'aria-controls': `mat-body-${m.id}`,
    }, [
      el('span', { class: 'material-row__label', text: m.label }),
      el('span', { class: 'material-row__meta' }, [
        el('span', { class: 'kind-chip', text: kindLabel(m.kind) }),
        el('span', { class: 'material-row__time', text: `updated ${formatRelativeGentle(m.updatedAt)}` }),
      ]),
    ]);
    head.addEventListener('click', () => {
      if (expandedMaterials.has(m.id)) expandedMaterials.delete(m.id); else expandedMaterials.add(m.id);
      renderMaterials();
      materialList.querySelector(`[data-id="${m.id}"] .material-row__head`)?.focus();
    });
    row.appendChild(head);

    const body = el('div', { class: 'material-row__body', id: `mat-body-${m.id}` });
    body.hidden = !expanded;
    if (expanded) {
      const labelInput = el('input', { class: 'usm-input', type: 'text', id: `mat-label-${m.id}`, 'aria-label': 'Name' });
      labelInput.value = m.label;
      const kindSelect = el('select', { class: 'usm-select', id: `mat-kind-${m.id}`, 'aria-label': 'Kind' },
        MATERIAL_KINDS.map((k) => el('option', { value: k.id, text: k.label })));
      kindSelect.value = m.kind;
      const textarea = el('textarea', { class: 'usm-textarea material-row__text', rows: '12', id: `mat-text-${m.id}`, 'aria-label': 'Text' });
      textarea.value = m.body;

      let dirty = false;
      const markDirty = () => { dirty = true; };
      const save = ({ quiet = false } = {}) => {
        if (!dirty) return;
        dirty = false;
        const { ok } = updateMaterial(m.id, { label: labelInput.value, kind: kindSelect.value, body: textarea.value });
        if (!quiet && ok) { showToast('Saved.'); announce('Material saved.'); }
      };
      for (const field of [labelInput, kindSelect, textarea]) {
        field.addEventListener('input', markDirty);
        field.addEventListener('change', markDirty);
        field.addEventListener('blur', () => save({ quiet: true }));
      }

      const saveBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'Save' });
      saveBtn.addEventListener('click', () => { if (!dirty) { showToast('Already saved.'); return; } save(); });
      const dupBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Duplicate' });
      dupBtn.addEventListener('click', () => {
        save({ quiet: true });
        const { item } = duplicateMaterial(m.id);
        if (item) {
          // The store's write already re-rendered; open the copy and render again.
          expandedMaterials.add(item.id);
          renderMaterials();
          materialList.querySelector(`[data-id="${item.id}"] .material-row__head`)?.focus();
          showToast('Copied. Edit the copy however you like.');
        }
      });
      const delBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Delete' });
      delBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: `Delete “${m.label}”?`, body: 'This only removes it from here. Nothing else changes.', okLabel: 'Delete' });
        if (!ok) return;
        expandedMaterials.delete(m.id);
        deleteMaterial(m.id);
        showToast('Deleted.');
        announce('Material deleted.');
        addMaterialBtn.focus();
      });

      body.append(
        el('div', { class: 'material-form__row' }, [
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: `mat-label-${m.id}`, text: 'Name' }), labelInput]),
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: `mat-kind-${m.id}`, text: 'Kind' }), kindSelect]),
        ]),
        el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: `mat-text-${m.id}`, text: 'Text' }), textarea]),
        el('div', { class: 'material-row__actions' }, [saveBtn, dupBtn, delBtn]),
      );
    }
    row.appendChild(body);
    return row;
  }

  function renderMaterials() {
    if (materialsCache.length === 0) {
      const go = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'Add your resume' });
      go.addEventListener('click', openMaterialForm);
      materialList.replaceChildren(el('div', { class: 'usm-empty' }, [
        el('p', { text: 'Paste your resume in once. Then never go looking for it again.' }),
        go,
      ]));
      return;
    }
    const sorted = materialsCache.slice().sort((a, b) =>
      (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    materialList.replaceChildren(...sorted.map((m, i) => renderMaterialRow(m, i)));
    revealRows(materialList);
  }

  /** Rows seen before appear at once; only genuinely new rows animate in. */
  function revealRows(container) {
    container.querySelectorAll('.reveal').forEach((row) => {
      const id = row.getAttribute('data-id');
      if (shownRows.has(id) || prefersReducedMotion()) row.classList.add('visible');
      else { shownRows.add(id); observeReveal(row); }
    });
  }

  /* ───────────────────────────── the tracker ───────────────────────────── */

  const appList = $('appList');
  const archivedList = $('archivedList');
  const archivedDisclosure = $('archivedDisclosure');
  const rowMenu = $('rowMenu');
  const rowMenuItems = $('rowMenuItems');

  /** One primary action per status. Archived rows have none: the record is already where it should be. */
  const PRIMARY_ACTION = {
    Saved: { label: 'Prepare this one', run: (app) => loadIntoAssembler(app) },
    Preparing: { label: 'Continue preparing', run: (app) => loadIntoAssembler(app) },
    Ready: { label: 'Mark applied', run: (app) => setStatus(app.id, 'Applied') },
    Applied: { label: 'Add interview date', run: (app) => openDetail(app.id, { focusField: 'd_interviewAt' }) },
    Interview: { label: 'Add a note', run: (app) => openDetail(app.id, { focusField: 'd_notes' }) },
    'Follow-up': { label: 'Mark followed up', run: (app) => { updateApplication(app.id, { status: 'Applied', followUpAt: null }); showToast('Noted. Back to waiting, calmly.'); } },
    Offer: { label: '🎉', run: (app) => openDetail(app.id) },
    Rejected: null,
    Closed: null,
  };

  function setStatus(id, status) {
    const patch = { status };
    const app = getApplication(id);
    if (status === 'Applied' && app && !app.appliedAt) patch.appliedAt = todayISO();
    updateApplication(id, patch);
    if (status === 'Applied') showToast('Marked applied. That one is out of your hands now.');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function timeOfDay(d) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /** The one date line for a row. Past dates read as facts in muted text, never as a warning. */
  function dateLine(app) {
    const next = nextAttention(app);
    if (next) {
      const soon = daysBetween(new Date(), next.at) < 7 ? formatRelativeGentle(next.at) : formatLongDate(next.at);
      if (next.kind === 'interview') return { text: `Interview ${soon}, ${timeOfDay(next.at)}`, muted: false };
      if (next.kind === 'deadline') return { text: `Closes ${soon}`, muted: false };
      return { text: `Follow up ${soon}`, muted: false };
    }
    if (app.interviewAt) return { text: `Interview was ${formatLongDate(new Date(app.interviewAt))}`, muted: true };
    if (app.appliedAt) return { text: `Applied ${formatLongDate(parseISO(app.appliedAt))}`, muted: true };
    if (app.deadline) return { text: `Closed on ${formatLongDate(parseISO(app.deadline))}`, muted: true };
    if (app.discoveredAt) return { text: `Found ${formatLongDate(parseISO(app.discoveredAt))}`, muted: true };
    return { text: '', muted: true };
  }

  function statusChip(status) {
    return el('span', { class: `usm-tone usm-tone--${STATUS_TONE[status] || 'quiet'}`, text: status });
  }

  function renderAppRow(app, index) {
    const row = el('article', { class: 'usm-card app-row reveal', 'data-delay': String((index % 4) + 1), 'data-id': app.id, id: app.id });
    const line = dateLine(app);

    const main = el('button', { type: 'button', class: 'app-row__main', 'aria-label': `${app.position || 'Untitled'}${app.organization ? `, ${app.organization}` : ''}. ${app.status}. Open details.` }, [
      el('span', { class: 'app-row__title', text: app.position || 'Untitled role' }),
      el('span', { class: 'app-row__org', text: app.organization || '' }),
      el('span', { class: 'app-row__line' }, [
        statusChip(app.status),
        el('span', { class: line.muted ? 'app-row__date is-muted' : 'app-row__date', text: line.text }),
      ]),
    ]);
    main.addEventListener('click', () => openDetail(app.id));

    const actions = el('div', { class: 'app-row__actions' });
    const primary = PRIMARY_ACTION[app.status];
    if (primary) {
      const btn = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary app-row__primary', text: primary.label, 'aria-label': primary.label === '🎉' ? 'An offer. Open it.' : null });
      btn.addEventListener('click', () => primary.run(getApplication(app.id) || app));
      actions.appendChild(btn);
    }
    const more = el('button', { type: 'button', class: 'usm-icon-btn app-row__more', 'aria-label': 'More actions', 'aria-haspopup': 'menu', text: '⋯' });
    more.addEventListener('click', () => openMenu(app.id, more));
    actions.appendChild(more);

    row.append(main, actions);
    return row;
  }

  function renderApplications() {
    const { active, archived } = orderForAttention(listApplications());

    if (active.length === 0) {
      const go = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'Prepare one' });
      go.addEventListener('click', () => { selectTab('prepare'); jdInput.focus(); });
      appList.replaceChildren(el('div', { class: 'usm-empty' }, [
        el('p', { text: "Nothing here yet. That's fine." }),
        go,
      ]));
    } else {
      appList.replaceChildren(...active.map((app, i) => renderAppRow(app, i)));
    }

    archivedDisclosure.hidden = archived.length === 0;
    archivedList.replaceChildren(...archived.map((app, i) => renderAppRow(app, i)));
    revealRows(appList);
    revealRows(archivedList);
  }

  /* — overflow menu — */

  function menuItemsFor(app) {
    const items = [{ label: 'Open', run: () => openDetail(app.id) }];
    if (!isArchived(app)) {
      if (app.status !== 'Preparing' && app.status !== 'Saved') items.push({ label: 'Prepare with this one', run: () => loadIntoAssembler(app) });
      if (app.status !== 'Ready' && ['Saved', 'Preparing'].includes(app.status)) items.push({ label: 'Mark ready', run: () => setStatus(app.id, 'Ready') });
      if (app.status !== 'Applied' && !['Interview', 'Offer', 'Follow-up'].includes(app.status)) items.push({ label: 'Mark applied', run: () => setStatus(app.id, 'Applied') });
      if (['Applied', 'Interview'].includes(app.status)) items.push({ label: 'Set a follow-up date', run: () => openDetail(app.id, { focusField: 'd_followUpAt' }) });
      items.push({ label: 'Close this one', run: () => setStatus(app.id, 'Closed') });
    } else {
      items.push({ label: 'Reopen', run: () => setStatus(app.id, 'Saved') });
    }
    items.push({
      label: 'Delete',
      danger: true,
      run: async () => {
        const ok = await confirmDialog({ title: 'Delete this application?', body: 'It disappears from here. Nothing else changes.', okLabel: 'Delete' });
        if (ok) { if (openDetailId === app.id) closeDetail({ restoreFocus: false }); deleteApplication(app.id); showToast('Deleted.'); }
      },
    });
    return items;
  }

  function openMenu(appId, anchor) {
    const app = getApplication(appId);
    if (!app) return;
    menuReturnFocus = anchor;
    rowMenuItems.replaceChildren(...menuItemsFor(app).map((item) => {
      const btn = el('button', { type: 'button', class: item.danger ? 'row-menu__item is-danger' : 'row-menu__item', role: 'menuitem', text: item.label });
      btn.addEventListener('click', () => { closeMenu(); item.run(); });
      return btn;
    }));
    rowMenu.hidden = false;
    if (!isPhone()) {
      // Sit under the ⋯ button on desktop; the bottom sheet is CSS-only on phones.
      const r = anchor.getBoundingClientRect();
      const sheet = rowMenuItems;
      sheet.style.top = `${r.bottom + window.scrollY + 6}px`;
      sheet.style.left = `${Math.max(8, r.right + window.scrollX - 220)}px`;
    } else {
      rowMenuItems.style.top = '';
      rowMenuItems.style.left = '';
    }
    requestAnimationFrame(() => rowMenuItems.querySelector('[role="menuitem"]')?.focus());
  }

  function closeMenu() {
    if (rowMenu.hidden) return;
    rowMenu.hidden = true;
    if (menuReturnFocus && document.contains(menuReturnFocus)) menuReturnFocus.focus();
    menuReturnFocus = null;
  }

  rowMenu.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-menu-close]')) closeMenu();
  });
  rowMenu.addEventListener('keydown', (e) => {
    const items = Array.from(rowMenuItems.querySelectorAll('[role="menuitem"]'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') { closeMenu(); }
  });

  /* — detail panel — */

  const detail = $('appDetail');
  const detailForm = $('appDetailForm');
  const detailTitle = $('appDetailTitle');
  const rejectionBlock = $('rejectionBlock');
  const jdToggle = $('jdToggle');
  const dJd = $('d_jobDescription');
  const dStatus = $('d_status');
  const dUrl = $('d_url');
  const dUrlLink = $('d_urlLink');

  dStatus.replaceChildren(...STATUSES.map((s) => el('option', { value: s, text: s })));

  const DETAIL_FIELDS = ['position', 'organization', 'status', 'url', 'deadline', 'discoveredAt', 'appliedAt', 'interviewAt', 'followUpAt', 'resumeUsed', 'coverLetter', 'referencesUsed', 'notes', 'outcome', 'jobDescription'];

  function fillMaterialSelect(select, kind, value) {
    const options = [el('option', { value: '', text: '—' })];
    for (const m of materialsCache) if (m.kind === kind) options.push(el('option', { value: m.id, text: m.label }));
    select.replaceChildren(...options);
    select.value = value && materialsCache.some((m) => m.id === value) ? value : '';
  }

  /** 'YYYY-MM-DDTHH:MM' in local time for a datetime-local input. */
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function renderUrlLink(url) {
    dUrlLink.replaceChildren();
    if (/^https?:\/\//.test(url)) {
      dUrlLink.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: 'Open the posting ↗' }));
    } else if (url) {
      dUrlLink.textContent = url; // not a web link; shown as plain text
    }
  }

  function fillDetail(app) {
    detailTitle.textContent = app.position || app.organization || 'Application';
    for (const name of DETAIL_FIELDS) {
      const field = detailForm.elements[name];
      if (!field) continue;
      if (name === 'interviewAt') field.value = toLocalInput(app.interviewAt);
      else if (name === 'resumeUsed') fillMaterialSelect(field, 'resume', app.resumeUsed);
      else if (name === 'coverLetter') fillMaterialSelect(field, 'coverLetter', app.coverLetter);
      else if (name === 'referencesUsed') fillMaterialSelect(field, 'references', app.referencesUsed);
      else field.value = app[name] == null ? '' : app[name];
    }
    renderUrlLink(app.url || '');
    rejectionBlock.hidden = app.status !== 'Rejected';
  }

  function readDetail() {
    const out = {};
    for (const name of DETAIL_FIELDS) {
      const field = detailForm.elements[name];
      if (field) out[name] = field.value;
    }
    return out;
  }

  function setJdExpanded(expanded) {
    dJd.rows = expanded ? 24 : 4;
    jdToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    jdToggle.textContent = expanded ? 'Show less' : 'Show full posting';
  }
  jdToggle.addEventListener('click', () => setJdExpanded(jdToggle.getAttribute('aria-expanded') !== 'true'));

  function openDetail(id, { focusField = null } = {}) {
    const app = getApplication(id);
    if (!app) return;
    closeMenu();
    if (openDetailId && openDetailId !== id) saveDetail.flush();
    openDetailId = id;
    detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fillDetail(app);
    setJdExpanded(false);
    detail.classList.add('is-open');
    document.body.classList.toggle('has-open-detail', isPhone());
    if (currentTab() !== 'applications') selectTab('applications');
    requestAnimationFrame(() => {
      const target = focusField ? $(focusField) : detail;
      target.focus({ preventScroll: false });
      if (!isPhone()) detail.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function closeDetail({ restoreFocus = true } = {}) {
    if (!openDetailId) return;
    saveDetail.flush();
    const id = openDetailId;
    openDetailId = null;
    detail.classList.remove('is-open');
    document.body.classList.remove('has-open-detail');
    if (restoreFocus) {
      // The list re-renders on every save, so look the row up fresh rather than trusting a stale node.
      const rowBtn = appList.querySelector(`[data-id="${id}"] .app-row__main`) || archivedList.querySelector(`[data-id="${id}"] .app-row__main`);
      const target = rowBtn || (detailReturnFocus && document.contains(detailReturnFocus) ? detailReturnFocus : tabs[2]);
      if (rowBtn && rowBtn.closest('details') && !rowBtn.closest('details').open) rowBtn.closest('details').open = true;
      target.focus();
    }
    detailReturnFocus = null;
  }

  function saveDetailNow() {
    if (!openDetailId) return;
    const before = getApplication(openDetailId);
    if (!before) return;
    const values = readDetail();
    const { item } = updateApplication(openDetailId, values);
    if (!item) return;
    if (item.status === 'Applied' && !item.appliedAt && before.status !== 'Applied') {
      updateApplication(openDetailId, { appliedAt: todayISO() });
      detailForm.elements.appliedAt.value = todayISO();
    }
    rejectionBlock.hidden = item.status !== 'Rejected';
    renderUrlLink(item.url || '');
    if (item.position || item.organization) detailTitle.textContent = item.position || item.organization;
  }
  const saveDetail = debounce(saveDetailNow, 300);

  detailForm.addEventListener('input', () => saveDetail());
  detailForm.addEventListener('change', () => { saveDetail.cancel(); saveDetailNow(); });
  detailForm.addEventListener('focusout', () => saveDetail.flush());
  detailForm.addEventListener('submit', (e) => { e.preventDefault(); saveDetail.flush(); });
  detail.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDetail(); }
  });
  $('detailCloseBtn').addEventListener('click', () => closeDetail());
  $('archiveBtn').addEventListener('click', () => { closeDetail(); showToast('Archived. On to the next one.'); announce('Archived.'); });
  $('detailPrepareBtn').addEventListener('click', () => {
    saveDetail.flush();
    const app = getApplication(openDetailId);
    if (app) loadIntoAssembler(app);
  });
  $('detailDeleteBtn').addEventListener('click', async () => {
    const id = openDetailId;
    const ok = await confirmDialog({ title: 'Delete this application?', body: 'It disappears from here. Nothing else changes.', okLabel: 'Delete' });
    if (!ok) return;
    closeDetail({ restoreFocus: false });
    deleteApplication(id);
    showToast('Deleted.');
    announce('Application deleted.');
    tabs[2].focus();
  });

  /* ───────────────────────────── export / import ───────────────────────────── */

  $('exportBtn').addEventListener('click', () => {
    try {
      const blob = new Blob([exportAll()], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const a = el('a', { href, download: backupFilename() });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      showToast('Backup downloaded. Keep it somewhere safe.');
      announce('Backup downloaded.');
    } catch (err) {
      warn('export failed', err);
      showToast("Couldn't make the backup file in this browser.");
    }
  });

  const importFile = $('importFile');
  $('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    importFile.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch (err) {
      warn('could not read the chosen file', err);
      showToast("Couldn't read that file.");
      return;
    }
    const ok = await confirmDialog({
      title: 'Import this backup?',
      body: 'Importing replaces everything currently here — every application and every material — with what is in the file.',
      okLabel: 'Replace and import',
    });
    if (!ok) return;
    try {
      closeDetail({ restoreFocus: false });
      importAll(text);
      showToast('Restored from your backup.');
      announce('Backup imported.');
    } catch (err) {
      warn('import failed', err);
      showToast(err && err.message ? err.message : "That file doesn't look like a backup.");
    }
  });

  /* ─────────────────────────── flush on the way out ─────────────────────────── */

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveDetail.flush(); });
  window.addEventListener('beforeunload', () => saveDetail.flush());
  window.addEventListener('pagehide', () => saveDetail.flush());

  /* ─────────────────────────────── subscriptions ─────────────────────────────── */

  subscribeMaterials((items) => {
    materialsCache = items;
    templateOverrides = getTemplateOverrides();
    renderMaterials();
    renderPicker();
    refreshTemplateEditor();
    renderPreviewNow();
    if (openDetailId) {
      const app = getApplication(openDetailId);
      if (app && !detailForm.contains(document.activeElement)) fillDetail(app);
    }
  });

  subscribeApplications(() => {
    renderApplications();
    if (openDetailId) {
      const app = getApplication(openDetailId);
      if (!app) { closeDetail({ restoreFocus: false }); return; }
      // Another tab may have changed it; only refill when she is not mid-edit here.
      if (!detailForm.contains(document.activeElement)) fillDetail(app);
    }
  });

  /* ─────────────────────────────── first paint ─────────────────────────────── */

  renderPillGroup(tonePills, TONES, currentTone.id, setTone);
  setTemplate(currentTemplateId, { applyDefaults: true });
  renderMaterials();
  renderApplications();

  const hash = location.hash.replace(/^#/, '');
  if (/^app_/.test(hash) && getApplication(hash)) {
    selectTab('applications', { hash: false });
    openDetail(hash);
  } else if (TAB_NAMES.includes(hash)) {
    selectTab(hash, { hash: false });
  } else {
    selectTab('prepare', { hash: false });
    // Autofocus the posting field on desktop only — a phone keyboard popping up unasked is rude.
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 601px) and (hover: hover)').matches) {
      jdInput.focus({ preventScroll: true });
    }
  }

  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
