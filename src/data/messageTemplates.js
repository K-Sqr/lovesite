// src/data/messageTemplates.js
// These have to sound like a person texting, not like a product.
// Rules for anything added here:
//   - contractions, lowercase where natural, at most one emoji
//   - no "I hope this message finds you well", no "reaching out", no "circling back"
//   - no em-dash-heavy corporate warmth, no enthusiasm she doesn't feel
//   - it must be sendable AS-IS, with no editing, on her worst day
// {name} is interpolated. Every template must still read correctly if {name} is missing.
//
// Items are plain strings on purpose (the words are the point). Each one gets a
// stable id of `${category.id}-${index}` in peopleStore.js so she can edit a
// default in place and later "Reset to default". Never reorder or delete an
// item here once shipped; append instead, or her overrides point at the wrong line.
export const defaultMessageTemplates = [
  {
    id: 'thinking',
    category: 'Thinking of you',
    items: [
      'Hey ❤️ just thinking about you. Hope you’re doing okay.',
      'You popped into my head today and I wanted you to know.',
      '{name} hi! no reason, just thought of you.',
    ],
  },
  {
    id: 'been-a-while',
    category: 'Haven’t talked in a while',
    items: [
      'Hey {name}! it’s been a minute. how have you been?',
      'I know it’s been a while but I still think about you often ❤️',
      'Hi {name} — not letting more time go by without saying hi.',
    ],
  },
  {
    id: 'busy-but-caring',
    category: 'Busy but caring',
    items: [
      'Life has been a lot lately but you’ve been on my mind.',
      'Hey {name}, I’m swamped right now so this is a drive-by hello. Love you.',
      'Can’t talk properly yet but I didn’t want to wait to say hi.',
    ],
  },
  {
    id: 'low-energy',
    category: 'Very low energy',
    items: [
      'Hey ❤️ no need for a whole conversation, just wanted you to know I’m thinking about you.',
      'hi {name} ❤️',
      'Low battery today but sending you love.',
    ],
  },
  {
    id: 'birthday',
    category: 'Birthday',
    items: [
      'Happy birthday {name} ❤️ I hope today is gentle and good to you.',
      'Happy birthday! so glad you were born.',
    ],
  },
  {
    id: 'after-hard',
    category: 'Checking in after something hard',
    items: [
      'Hey {name}, just checking in. No need to reply if you’re not up to it.',
      'Thinking about you today. I’m here whenever you want to talk, or not talk.',
      'How are you doing, really?',
    ],
  },
];
