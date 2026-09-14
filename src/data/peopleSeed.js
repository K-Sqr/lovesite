/**
 * Starter people for the gift. He fills this in so she doesn't meet an empty page.
 * Stable `slug` values become ids (`per_seed_<slug>`) so a later seed merge
 * can recognise them and not duplicate.
 *
 * Cadence: best friends ~ every two weeks → `few-weeks`.
 * Family and friends start at `monthly`. Mentors at `seasonally`.
 * She can change any of this; nothing here is a quota.
 */
export const PEOPLE_CATEGORIES = ['Best friend', 'Family', 'Friend', 'Mentor'];

export const peopleSeed = [
  // Best friends — they talk around every two weeks
  { slug: 'peace', name: 'Peace', relationship: 'Best friend', preferredCadence: 'few-weeks', energyCost: 'low' },
  { slug: 'mary', name: 'Mary', relationship: 'Best friend', preferredCadence: 'few-weeks', energyCost: 'low' },
  { slug: 'tammy', name: 'Tammy', relationship: 'Best friend', preferredCadence: 'few-weeks', energyCost: 'low' },

  // Family — general names, as asked
  { slug: 'sisters', name: 'Sisters', relationship: 'Family', preferredCadence: 'monthly', energyCost: 'medium' },
  { slug: 'father', name: 'Father', relationship: 'Family', preferredCadence: 'monthly', energyCost: 'medium' },
  { slug: 'mother', name: 'Mother', relationship: 'Family', preferredCadence: 'monthly', energyCost: 'medium' },

  // Friends
  { slug: 'violet', name: 'Violet', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'gbemi', name: 'Gbemi', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'tobi', name: 'Tobi', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'kelvin', name: 'Kelvin', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'timmy', name: 'Timmy', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'gbemileke', name: 'Gbemileke', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'low' },
  { slug: 'pastor-bassey', name: 'Pastor Bassey', relationship: 'Friend', preferredCadence: 'monthly', energyCost: 'medium' },

  // Mentors
  { slug: 'jackie', name: 'Jackie', relationship: 'Mentor', preferredCadence: 'seasonally', energyCost: 'medium' },
  { slug: 'elden', name: 'Elden', relationship: 'Mentor', preferredCadence: 'seasonally', energyCost: 'medium' },
  { slug: 'steve', name: 'Steve', relationship: 'Mentor', preferredCadence: 'seasonally', energyCost: 'medium' },
  { slug: 'pastor-ige', name: 'Pastor Ige', relationship: 'Mentor', preferredCadence: 'seasonally', energyCost: 'medium' },
];
