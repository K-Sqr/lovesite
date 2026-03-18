import { milestones, getPreviewMilestones } from '../data/milestones.js';

export function initTimeline(full = false) {
  const container = document.querySelector('.timeline');
  if (!container) return;

  const items = full ? milestones : getPreviewMilestones();

  items.forEach((m, i) => {
    const entry = document.createElement('div');
    entry.className = 'timeline-entry reveal';
    entry.setAttribute('data-delay', String((i % 4) + 1));
    entry.innerHTML = `
      <div class="timeline-icon">${m.icon}</div>
      <div class="timeline-date">${m.date}</div>
      <h3>${m.title}</h3>
      <p>${m.description}</p>
    `;
    container.appendChild(entry);
  });

  if (!full) {
    const link = document.createElement('a');
    link.href = './timeline.html';
    link.className = 'view-all-link reveal';
    link.setAttribute('data-delay', '2');
    link.textContent = 'View full timeline \u2192';
    container.parentElement.appendChild(link);
  }
}
