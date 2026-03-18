import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/memories.css';
import './styles/timeline-page.css';

import { initTimeline } from './modules/timeline.js';
import { milestones } from './data/milestones.js';

function calculateStats() {
  const statsContainer = document.getElementById('timelineStats');
  if (!statsContainer) return;

  const startDate = new Date(2025, 8, 13);
  const now = new Date();
  const diffMs = now - startDate;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30.44);

  statsContainer.innerHTML = `
    <div class="stat-card reveal" data-delay="1">
      <div class="stat-number">${days}</div>
      <div class="stat-label">days together</div>
    </div>
    <div class="stat-card reveal" data-delay="2">
      <div class="stat-number">${months}</div>
      <div class="stat-label">months</div>
    </div>
    <div class="stat-card reveal" data-delay="3">
      <div class="stat-number">${milestones.length}</div>
      <div class="stat-label">milestones</div>
    </div>
  `;
}

function setupScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  calculateStats();
  initTimeline(true);
  requestAnimationFrame(() => setTimeout(setupScrollReveal, 50));
});
