import { milestones } from '../data/milestones.js';

export function initTimeline() {
  const container = document.querySelector('.timeline');
  if (!container) return;

  milestones.forEach((m, i) => {
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
}
