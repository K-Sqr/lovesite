/**
 * timeline.js — the single source of truth for the story.
 *
 * Every entry here traces to a row in docs/anniversary/TIMELINE-CONTENT.md.
 * Nothing is invented. Entries whose description is still marked ✍️ in that
 * sheet ship with `description: ''` and a TODO(emmanuel) — see the authoring
 * stub at the bottom of this file.
 *
 * Shape (05-TIMELINE.md R1):
 *   id            stable kebab-case slug — permanent once shipped (URL anchors, chunks.json)
 *   date          ISO YYYY-MM-DD — the ONLY field anything sorts/groups/counts by
 *   dateDisplay   optional override for the label; otherwise formatDisplayDate(date)
 *   title, description, icon
 *   expandedBody  optional longer prose behind a "Read more" disclosure (full page only)
 *   type          milestone | trip | anniversary | letter | conversation | funny | event | memory
 *   featured      curated emphasis; the home preview takes a capped slice of these
 *   location      optional
 *   tags          optional, not surfaced yet
 *   photos        optional [{ src: './photos/…' | 'https://…', alt (required), caption }]
 *
 * This file is inlined into the public bundle. Never put a passphrase, key,
 * address, or phone number in an entry.
 */

import { parseISO } from '../modules/dates.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Aug 18, 2025' from an ISO date — the format the cards have always shown. */
export function formatDisplayDate(iso) {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** What a human sees for an entry's date. */
export function displayDate(entry) {
  return entry.dateDisplay ?? formatDisplayDate(entry.date);
}

export const timeline = [
  // ── 2025 ──────────────────────────────────────────────────────────────────
  {
    id: 'confession',
    date: '2025-08-18',
    title: 'The Confession',
    description: 'Sunday to Monday, 12:12am. Emmanuel preached a full sermon on Proverbs 18:22: "He who finds a wife finds a good thing." At point three, he turned to Tolu and said: "I\u2019ve fallen deeply in love with you." She went from shock, to flattered, to terrified \u2014 and told him she\u2019d pray about it.',
    icon: '\u{1F49C}',
    type: 'milestone',
    featured: true,
  },
  {
    id: 'her-questions',
    date: '2025-08-19', // Decision 1 resolved by the owner: Aug 19 (2026-09-13)
    title: 'The Questions',
    description: 'She told him the good traits she saw in him, and gave him questions about himself to answer \u2014 then come back and ask her properly.',
    icon: '\u{1F4DD}',
    type: 'conversation',
    featured: false,
  },
  {
    id: 'prophetic-encounter',
    date: '2025-08-23',
    title: 'The Prophetic Encounter',
    description: 'After an AISIC program, a man approached Tolu and told her that her husband was coming \u2014 she shouldn\u2019t go looking, she would know when he came. He gave her his card and said: "Invite me to the wedding in 2\u20133 years." The first person she thought of was Emmanuel.',
    icon: '\u{1F54A}\u{FE0F}',
    type: 'event',
    featured: false,
  },
  {
    id: 'gods-confirmation',
    date: '2025-09-01',
    title: 'God\u2019s Confirmation',
    description: 'Tolu received a message from God at 5am: "Tolu it\u2019s him. You\u2019re simply asking if it\u2019s okay to fall. I\u2019ll catch you. He will too." She started to fall freely.',
    icon: '\u{1F31F}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'falling-in-love',
    date: '2025-09-11',
    title: '"I\u2019m Falling In Love With You"',
    description: 'Sitting under his cold blanket in that freezing basement, Emmanuel heard the warmest words ever spoken to his soul. She said it so softly, yet it shook his entire world.',
    icon: '\u{1F495}',
    type: 'conversation',
    featured: false,
  },
  {
    id: 'she-said-yes',
    date: '2025-09-13',
    dateDisplay: 'Sep 13, 2025, 2am', // owner amendment: "add 2am" — shown on the label, prose untouched
    title: 'She Said Yes',
    description: 'He sent her to the coded website. She clicked yes immediately \u2014 the 2\u20135 minutes of anxiety he experienced while waiting was completely on him. She saw him wipe off a tear. They became official.',
    icon: '\u{1F496}',
    type: 'milestone',
    featured: true,
  },
  {
    id: 'first-girlfriend-gifts',
    date: '2025-09-19',
    title: 'First Gifts',
    description: 'Her first girlfriend gifts: striped pink PJs, a comfy pillowcase, and earplugs.',
    icon: '\u{1F381}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'first-virtual-date',
    date: '2025-09-20',
    title: 'First Virtual Date',
    description: 'Their first date \u2014 virtual, but it felt like they were right next to each other. They discovered her favorite foods (potatoes, amala), her movies (Infinity War, Whiplash), and that if stranded on a desert island she\u2019d bring: him, the Bible, and something to write with.',
    icon: '\u{1F4F1}',
    type: 'event',
    featured: false,
  },
  {
    id: 'first-love-letter',
    date: '2025-10-02',
    title: 'First Love Letter',
    description: 'Tolu received her first love letter from Emmanuel. She read it "5 times while squealing, giggling and kicking my feet in the air." She hid in her blanket from the absolute adorableness of it.',
    icon: '\u{1F48C}',
    type: 'letter',
    featured: false,
  },
  {
    id: 'first-storm',
    date: '2025-10-18',
    title: 'First Storm, Stronger Together',
    description: 'Emmanuel couldn\u2019t travel to see her. It hurt them both deeply. But through the storm she showed her true character: supportive, empathetic, calm, forgiving, and patient. She became his safe harbor.',
    icon: '\u{26C8}\u{FE0F}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'her-24th-birthday',
    date: '2025-10-26',
    title: 'Her 24th Birthday',
    description: 'Celebrated with prayers, letters, and gifts. Emmanuel wrote a detailed prayer covering her health, career, the book Rafah, reconciliation with her parents, and their future. She is his royal queen.',
    icon: '\u{1F382}',
    type: 'event',
    featured: false,
  },
  {
    id: 'his-23rd-birthday',
    date: '2025-11-14',
    title: 'His 23rd Birthday',
    description: 'Tolu celebrated him with an extensive birthday prayer declaring blessings from Isaiah 43, Psalm 91, and Joshua 1. She gifted him a jacket, boots, a turtleneck, and a chain \u2014 and her love was audible in all 5 love languages.',
    icon: '\u{1F389}',
    type: 'event',
    featured: false,
  },
  {
    id: 'love-journal',
    date: '2025-11-14',
    title: 'The Love Journal',
    // TODO(emmanuel): Decision 2 — verify against the journal itself: 54 pages or ~50, since Aug 18 or Aug 19.
    // Kept verbatim from the original entry per your answer (2026-09-13).
    description: 'She surprised him with a 54-page love journal she\u2019d been writing since August 18. Every page a piece of her heart \u2014 documenting her side of their love story, her prayers, her fears, and her growing love.',
    icon: '\u{1F4D6}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'hymns-and-healing',
    date: '2025-11-26',
    title: 'Hymns & Healing',
    description: 'Date night at Brian\u2019s. They sang hymns together for the first time. Tolu had a panic attack triggered by old memories, but Emmanuel prayed for her and said firmly: "There is enough air to breathe." She thought: "I\u2019m definitely going to marry this guy."',
    icon: '\u{1F3B6}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'first-good-dream',
    date: '2025-12-04',
    title: 'Her First Good Dream',
    description: 'After years without a good dream, Tolu dreamed of Emmanuel sending her a marriage form filled with his information. She woke up grinning. God was showing her the future.',
    icon: '\u{1F4AD}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'three-months',
    date: '2025-12-13',
    title: 'Three Months',
    description: '92 days and a quarter of a year learning and loving each other. He sent her Alfredo pasta and a letter. She wrote: "Ade mi, I am really thankful that you see me clearly."',
    icon: '\u{2728}',
    type: 'anniversary',
    featured: false,
  },
  {
    id: 'first-christmas',
    date: '2025-12-25',
    title: 'First Christmas Together',
    // NOTE(emmanuel): your line, lightly extended with your permission (2026-09-13). Edit freely.
    description: 'Our first Christmas \u2014 a screen apart, and somehow the warmest one yet. Celebrating with you made everything warmer.',
    icon: '\u{1F384}',
    type: 'event',
    featured: false,
  },
  {
    id: 'new-years-eve',
    date: '2025-12-31',
    title: 'New Year\u2019s Eve Together',
    description: 'Long distance but hearts closer than ever. They prayed the year in over the phone, eyes locked on the screen. They planned their future \u2014 the dreams, the babies, the home, the legacy. She smiled and said: "This is our year."',
    icon: '\u{1F386}',
    type: 'event',
    featured: false,
  },

  // ── 2026 ──────────────────────────────────────────────────────────────────
  {
    id: 'new-year-same-us',
    date: '2026-01-01',
    title: 'New Year, Same Us',
    // NOTE(emmanuel): your line, lightly extended with your permission (2026-09-13). Edit freely.
    description: 'Started a new year with my lover by my side. Best resolution ever. Some things you don\u2019t change \u2014 you just keep choosing them.',
    icon: '\u{1F395}\u{FE0F}',
    type: 'anniversary',
    featured: false,
  },
  {
    id: 'touchdown-winnipeg',
    date: '2026-02-09',
    title: 'Touchdown Winnipeg',
    description: '"When you knocked on my door and I saw you, I thought: Finally\u2026 That\u2019s my babe\u2026 I\u2019ve missed you." Hugging him felt like coming home. He walked in like a dream come true. Miracle no dey tire Jesus.',
    icon: '\u{1F917}',
    type: 'trip',
    featured: true,
  },
  {
    id: 'meeting-peace',
    date: '2026-02-11',
    title: 'Meeting Peace',
    description: 'He met her best friend Peace.',
    icon: '\u{1F91D}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'first-shopping-together',
    date: '2026-02-12',
    title: 'First Time Shopping Together',
    description: 'First time shopping together \u2014 and she bought him spectacular jackets.',
    icon: '\u{1F6CD}\u{FE0F}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'meeting-her-pastor',
    date: '2026-02-12',
    title: 'Meeting Her Pastor',
    description: 'They went to see her pastor at his house.',
    icon: '\u{1F64F}',
    type: 'event',
    featured: false,
  },
  {
    id: 'first-in-person-date',
    date: '2026-02-14',
    title: 'First In-Person Date',
    description: 'Valentine\u2019s Day at Ume Yummy, a Vietnamese restaurant. Their first real date, face to face. She in his sweatshirt, him lost in her smile that\u2019s 100x more powerful in person.',
    icon: '\u{2764}\u{FE0F}',
    type: 'milestone',
    featured: true,
  },
  {
    id: 'she-became-an-aunt',
    date: '2026-03-12',
    title: 'She Became an Aunt',
    description: 'Jayden was born. She became an aunt \u2014 one day before their six months.',
    icon: '\u{1F476}',
    type: 'event',
    featured: false,
  },
  {
    id: 'six-months',
    date: '2026-03-13',
    title: 'Six Months \u2014 Happy 180 Days',
    description: '"This is the woman I\u2019m marrying." Emmanuel wrote a 10-page love letter chronicling every month from September to March. He ended it on his knees in gratitude, thanking God for the privilege of calling her his.',
    expandedBody: 'I made this site, and we celebrated together', // owner's note, verbatim (2026-09-13)
    icon: '\u{1F38A}',
    type: 'anniversary',
    featured: true,
  },
  {
    id: 'student-success-story',
    date: '2026-05-07',
    title: 'Student Success Story',
    description: 'She was featured on her school\u2019s website as one of their student success stories.',
    icon: '\u{1F31F}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'his-graduation',
    date: '2026-05-25',
    title: 'His Graduation',
    description: 'They celebrated his college graduation.',
    icon: '\u{1F393}',
    type: 'milestone',
    featured: true,
  },
  {
    id: 'her-graduation',
    date: '2026-06-11',
    title: 'Bachelor of Arts, Honours',
    description: 'Bachelor of Arts in Psychology (Honours), Minor in English. They celebrated her graduation.',
    icon: '\u{1F393}',
    type: 'milestone',
    featured: true,
  },
  {
    id: 'rapha-immersive-experience',
    date: '2026-06-21',
    title: 'Rapha \u2014 The Immersive Experience',
    description: 'A God-sent project they partnered and delivered \u2014 the Rapha immersive experience.',
    icon: '\u{1F3AD}',
    type: 'event',
    featured: true,
  },
  {
    id: 'rapha-exhibition',
    date: '2026-06-24',
    title: 'Rapha \u2014 The Exhibition',
    description: 'Rapha the Exhibition \u2014 the second of the projects they delivered together.',
    icon: '\u{1F5BC}\u{FE0F}',
    type: 'event',
    featured: false,
  },
  {
    id: 'composed-a-song',
    date: '2026-06-17',
    title: 'She Composed a Song',
    description: 'She composed and directed a beautiful song with Anu, Testimony, and Stephen.',
    icon: '\u{1F3B5}',
    type: 'event',
    featured: false,
  },
  {
    id: 'summer-visit',
    date: '2026-06-18',
    title: 'Summer \u2014 Coming to See Her',
    description: 'He came to see her in the summer.',
    icon: '\u{2600}\u{FE0F}',
    type: 'trip',
    featured: true,
    location: 'Winnipeg',
  },
  {
    id: 'boston-pizza',
    date: '2026-07-04',
    title: 'Second In-Person Date',
    description: 'Their second in-person date \u2014 Boston Pizza.',
    icon: '\u{1F355}',
    type: 'event',
    featured: false,
  },
  {
    id: 'throne-of-glass',
    date: '2026-07-06',
    title: 'Throne of Glass',
    description: 'She got her hands on Throne of Glass \u2014 her graduation gift.',
    icon: '\u{1F4DA}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'first-gym-together',
    date: '2026-07-09',
    title: 'First Time at the Gym',
    description: 'First time at the gym together, pumping iron. After, a massage.',
    icon: '\u{1F3CB}\u{FE0F}',
    type: 'funny',
    featured: false,
  },
  {
    id: 'ten-months',
    date: '2026-07-13',
    title: 'Ten Months',
    description: 'They celebrated ten months together.',
    icon: '\u{2728}',
    type: 'anniversary',
    featured: false,
  },
  {
    id: 'hosting-ibukun',
    date: '2026-07-25',
    title: 'Hosting Ibukun',
    description: 'She hosted his sister Ibukun \u2014 they had a stellar conversation.',
    icon: '\u{1F3E0}',
    type: 'memory',
    featured: false,
  },
  {
    id: 'blood-types-compatible',
    date: '2026-08-03',
    title: 'Compatible',
    description: 'They took blood tests and found their types are compatible.',
    icon: '\u{1FA78}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'his-new-job',
    date: '2026-08-10',
    title: 'His New Job',
    description: 'They celebrated him starting his new job.',
    icon: '\u{1F4BC}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'her-first-interview',
    date: '2026-08-25',
    title: 'Her First Interview',
    description: 'Her first job interview \u2014 with the University of Manitoba.',
    icon: '\u{1F91D}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'internship-complete',
    date: '2026-08-27',
    title: 'Internship Complete',
    description: 'She concluded her internship at Resilia.',
    icon: '\u{1F3C1}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'his-first-car',
    date: '2026-09-01',
    title: 'His First Car',
    description: 'They celebrated his first car.',
    icon: '\u{1F697}',
    type: 'milestone',
    featured: false,
  },
  {
    id: 'touchdown-toronto',
    date: '2026-09-04',
    title: 'Touchdown Toronto',
    description: 'She came to Toronto \u2014 stayed with Itunu, met Sinam, and saw his family.',
    icon: '\u{2708}\u{FE0F}',
    type: 'trip',
    featured: true,
    location: 'Toronto',
  },
  {
    id: 'one-year',
    date: '2026-09-13',
    title: 'One Year',
    description: 'To the one that holds my heart \u2014 happy anniversary, baby girl. I love you. One year with the one; how wonderful.',
    icon: '\u{1F49D}',
    type: 'anniversary',
    featured: true,
    // The anniversary video (17-ANNIVERSARY-VIDEO.md, YouTube-link version). Full story only.
    video: { href: 'https://youtu.be/IfSrv6Km4Y8', label: 'click me' },
  },
];

// ── Derived helpers — pure functions over `timeline`, nothing baked in at module scope ──

/** Stable sort on ISO `date`; entries sharing a date keep their authored order. */
export function sortedByDate(order = 'asc') {
  const dir = order === 'desc' ? -1 : 1;
  return timeline
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      if (a.entry.date < b.entry.date) return -1 * dir;
      if (a.entry.date > b.entry.date) return 1 * dir;
      return (a.i - b.i) * dir;
    })
    .map(({ entry }) => entry);
}

/** Entries with featured === true, chronological. */
export function getFeatured() {
  return sortedByDate('asc').filter((e) => e.featured === true);
}

/**
 * Home-page preview — the intimate short list.
 * Order is authored, not "first five featured".
 */
const HOME_IDS = [
  'confession',
  'she-said-yes',
  'touchdown-winnipeg',
  'first-in-person-date',
  'six-months',
  'his-graduation',
  'her-graduation',
  'summer-visit',
  'rapha-immersive-experience',
  'touchdown-toronto',
  'one-year',
];

export function getHomeMoments() {
  return HOME_IDS.map((id) => getById(id)).filter(Boolean);
}

export function getById(id) {
  return timeline.find((e) => e.id === id);
}

/** [{ year: 2025, entries: [...] }, ...] ascending, entries chronological within each year. */
export function groupByYear() {
  const groups = [];
  for (const entry of sortedByDate('asc')) {
    const year = Number(entry.date.slice(0, 4));
    let group = groups[groups.length - 1];
    if (!group || group.year !== year) {
      group = { year, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

export function countByType(type) {
  return timeline.filter((e) => e.type === type).length;
}

/** Total photos across all entries. */
export function photoCount() {
  return timeline.reduce((n, e) => n + (Array.isArray(e.photos) ? e.photos.length : 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ✍️  AUTHORING STUB — Emmanuel fills this in. Nobody else. No AI.
//
//  Two jobs for this block:
//
//  1. Finish the entries above that still have `description: ''` and a
//     TODO(emmanuel). They are real moments with dates; only the words are
//     missing. See docs/anniversary/TIMELINE-CONTENT.md.
//
//  2. Add future moments. Still undated, from the rough sheet:
//       - finished conducting her research experiments, in record time
//       - defended her thesis
//     Date them and they can go in.
//
//  Copy the block below once per real moment, delete the placeholder text, and
//  move the finished object up into the `timeline` array in date order.
//  An entry needs: id, date, title, description, icon, type. Everything else
//  is optional. A one-line entry is worth more than an invented paragraph.
//
//  Worth reaching for, if they happened: a trip, a hard week you got through,
//  something she said that you wrote down, a meal, an inside joke with a date
//  attached, the first time something felt ordinary in a good way.
//
//  {
//    id: '',                  // kebab-case, unique, permanent
//    date: '2026-__-__',      // ISO
//    title: '',
//    description: '',         // one or two sentences, always visible
//    expandedBody: '',        // optional — the longer version
//    icon: '',                // emoji
//    type: '',                // milestone | trip | anniversary | letter
//                             // | conversation | funny | event | memory
//    featured: false,
//    location: '',            // optional
//    photos: [],              // optional — { src, alt, caption }
//  },
//
//  The 2026-09-13 one-year entry is the one that matters. Write it last and
//  write it longest — it is also what triggers the celebration in R7b.
// ─────────────────────────────────────────────────────────────────────────────
