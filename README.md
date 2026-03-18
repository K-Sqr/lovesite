# Lovesite

A romantic love story website built with vanilla JavaScript, CSS animations, and a whole lot of heart.

## What It Is

A creative front-end project that tells a love story through interactive web animations. Originally built as a "Will you go out with me?" page, now upgraded into a multi-section scrollable experience featuring:

- **Sparkle text reveal** -- letter-by-letter message with glitter effects
- **Interactive buttons** -- a playful "No" button that dodges clicks
- **Relationship timeline** -- milestones with scroll-triggered animations
- **Photo gallery** -- memory wall with Firebase-powered image uploads
- **Bible verse carousel** -- rotating love verses from Scripture
- **Floating hearts** -- parallax background animation
- **Background music player** -- toggle for ambient audio
- **Celebration mode** -- heart rain and verse overlay on "Yes"
- **Memories page** -- dedicated gallery with passcode-gated image uploads

## Tech Stack

- **Vite** -- build tool and dev server
- **Vanilla JS** -- ES modules, no framework
- **Firebase** -- Storage + Firestore for image uploads
- **CSS3** -- custom properties, animations, grid, flexbox, clamp()
- **Google Fonts** -- Dancing Script + Inter

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` to see the site.

## Customization

### Milestones

Edit `src/data/milestones.js` to add your own relationship milestones:

```js
{
  date: 'Sep 2025',
  title: 'The Ask',
  description: 'I sent you a little website and held my breath.',
  icon: '\u{1F496}',
}
```

### Photos

Upload photos directly through the memories page, or drop images into `public/photos/`.

### Music

Place an audio file in `public/music/` and update the `<source>` tag in `index.html`.

### Firebase

Update the config in `src/modules/firebase.js` with your Firebase project credentials.

### Webhook

Set `RESPONSE_WEBHOOK_URL` in `src/modules/webhook.js` to a Formspree or Discord webhook URL to get notified when she clicks.

## Deployment

Deploy to GitHub Pages:

```bash
npm run deploy
```

This builds the site and pushes `dist/` to the `gh-pages` branch.

## License

MIT
