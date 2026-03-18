// Main page shows a condensed preview; the full timeline page shows everything.
// Edit these freely -- the timeline page and main page both read from here.

export const milestones = [
  {
    date: 'Aug 15, 2025',
    title: 'The Good Traits',
    description: 'She told me the good traits she sees in me, gave me questions about myself to answer, and said to come back later.',
    icon: '\u{1F4DD}',
  },
  {
    date: 'Aug 18, 2025',
    title: 'I Confessed My Love',
    description: 'Sunday to Monday, 12:12am. I told her how I feel and asked her to be my ezer.',
    icon: '\u{1F49C}',
  },
  {
    date: 'Aug 2025',
    title: 'She Prayed About It',
    description: 'She went to pray about it and came back with feedback and some of her concerns.',
    icon: '\u{1F64F}',
  },
  {
    date: 'Sep 11, 2025',
    title: '"I\'m Falling in Love"',
    description: 'She confessed she was falling in love with me.',
    icon: '\u{1F970}',
  },
  {
    date: 'Sep 13, 2025',
    title: 'The Ask \u2014 2am',
    description: 'I asked her to be my co-captain using this very website. She said yes.',
    icon: '\u{1F496}',
  },
  {
    date: 'Sep 19, 2025',
    title: 'First Girlfriend Gifts',
    description: 'Striped pink PJ\u2019s, a comfy pillow case, and some earplugs. The essentials.',
    icon: '\u{1F381}',
  },
  {
    date: 'Sep 20, 2025',
    title: 'First Virtual Date',
    description: 'Our very first date \u2014 virtual, but it felt like we were right next to each other.',
    icon: '\u{1F4F1}',
  },
  {
    date: 'Oct 26, 2025',
    title: 'Her Birthday',
    description: 'Celebrated her special day. Details to come...',
    icon: '\u{1F382}',
  },
  {
    date: 'Nov 2025',
    title: 'Two Months In',
    description: 'Our inside jokes started piling up. Laughter became our language.',
    icon: '\u{1F602}',
  },
  {
    date: 'Dec 2025',
    title: 'First Holidays Together',
    description: 'Celebrating with you made everything warmer.',
    icon: '\u{2744}\u{FE0F}',
  },
  {
    date: 'Jan 2026',
    title: 'New Year, Same Us',
    description: 'Started a new year with you by my side. Best resolution ever.',
    icon: '\u{1F389}',
  },
  {
    date: 'Mar 2026',
    title: 'Six Months!',
    description: 'Half a year and I\u2019d do it all again in a heartbeat.',
    icon: '\u{1F38A}',
  },
];

// Short preview for the main page (first 4 + last entry)
export function getPreviewMilestones() {
  if (milestones.length <= 5) return milestones;
  return [...milestones.slice(0, 4), milestones[milestones.length - 1]];
}
