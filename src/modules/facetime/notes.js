/**
 * notes.js — his words, read from `<template data-note="...">` blocks in the HTML.
 *
 * Empty blocks mean "nothing to show", so a note that has not been written
 * never appears half-finished. Line breaks become paragraphs.
 */

/** @returns {Map<string, string[]>} note name → paragraphs */
export function readNotes(root = document) {
  const notes = new Map();
  root.querySelectorAll('template[data-note]').forEach((tpl) => {
    const name = tpl.dataset.note;
    const text = (tpl.content.textContent || tpl.textContent || '').trim();
    if (!text) return;
    const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length) notes.set(name, paragraphs);
  });
  return notes;
}

/**
 * Render a note as a block of script paragraphs, or null when it is empty.
 * @param {Map<string,string[]>} notes
 */
export function noteBlock(notes, name, className = 'ft-note') {
  const paragraphs = notes.get(name);
  if (!paragraphs) return null;
  const block = document.createElement('div');
  block.className = className;
  paragraphs.forEach((p) => {
    const para = document.createElement('p');
    para.textContent = p;
    block.appendChild(para);
  });
  return block;
}
