/**
 * Letter metadata only. Bodies stay in letters-source/, never in this file.
 *
 * Dates are the ones written at the top of each letter.
 * Sorted oldest → newest in the archive (the order he wrote them).
 *
 * @typedef {Object} Letter
 * @property {string} id
 * @property {string|null} file
 * @property {string} title
 * @property {string} occasion
 * @property {string} date          'YYYY-MM-DD'
 * @property {string} teaser
 * @property {boolean} [comingSoon]
 */

/** @type {Letter[]} */
export const letters = [
  {
    id: 'first-of-many',
    file: 'First of many.pdf',
    title: 'First of many',
    occasion: 'The first letter',
    date: '2025-10-02',
    teaser: 'The first letter I ever wrote to you.',
  },
  {
    id: 'first-birthday',
    file: 'First Birthday.pdf',
    title: 'First Birthday',
    occasion: 'Your birthday',
    date: '2025-10-26',
    teaser: 'A prayer for you, on the first birthday we celebrated while dating.',
  },
  {
    id: 'random-thought',
    file: 'Random thought.pdf',
    title: 'Random thought',
    occasion: 'A thought',
    date: '2025-11-02',
    teaser: 'Literally a random thought I had, written down and sent.',
  },
  {
    id: 'build-up',
    file: 'Build up.pdf',
    title: 'Build up',
    occasion: 'When you needed steadying',
    date: '2025-11-28',
    teaser: 'Written to comfort and reassure you after a panic attack.',
  },
  {
    id: '92dn',
    file: '92DN.pdf',
    title: '92DN',
    occasion: 'Three months',
    date: '2025-12-13',
    teaser: 'Celebrating three months together.',
  },
  {
    id: 'valentines',
    file: 'Valentines.pdf',
    title: 'Valentines',
    occasion: 'Valentine’s Day',
    date: '2026-01-13',
    teaser: 'A poem I wrote for you for Valentine’s.',
  },
  {
    id: 'happy-180-days',
    file: 'Happy 180 days.pdf',
    title: 'Happy 180 days',
    occasion: 'Six months',
    date: '2026-03-12',
    teaser: 'The letter for our six months.',
  },
  {
    id: '7',
    file: '7.pdf',
    title: '7',
    occasion: 'Seven months',
    date: '2026-03-20',
    teaser: 'Happy seven months — and a surprise portfolio site I built for you.',
  },
  {
    id: 'blazing-hot',
    file: 'Blazing Hot (1).pdf',
    title: 'Blazing Hot',
    occasion: 'Your excellence',
    date: '2026-06-01',
    teaser: 'A letter of acknowledgement — written because of how you shine.',
  },
  {
    id: 'one-year-with-the-one',
    file: 'One year with the One.pdf',
    title: 'One year with the one',
    occasion: 'One year',
    date: '2026-09-13',
    teaser: 'The letter for our first year.',
  },
];

/** Letters that exist as files — the timeline stats bar. */
export function letterCount() {
  return letters.filter((l) => l.file).length;
}

export function displayTitle(letter) {
  return letter.title || letter.occasion || (letter.file ? letter.file.replace(/\.[^.]+$/, '') : 'Letter');
}

/** Oldest first — the order they were written. Coming-soon last if undated. */
export function sortOldestFirst(list) {
  return list
    .map((letter, index) => ({ letter, index }))
    .sort((a, b) => {
      const da = a.letter.date || '9999';
      const db = b.letter.date || '9999';
      if (da !== db) return da.localeCompare(db);
      return a.index - b.index;
    })
    .map((x) => x.letter);
}

export function sortNewestFirst(list) {
  return sortOldestFirst(list).slice().reverse();
}

export function groupByYear(list) {
  const groups = [];
  for (const letter of list) {
    const year = letter.date ? letter.date.slice(0, 4) : null;
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.letters.push(letter);
    else groups.push({ year, letters: [letter] });
  }
  return groups;
}
