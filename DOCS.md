# Us Machina — Project Documentation

> *love in the machine*

## Table of Contents

- [Overview](#overview)
- [Origin Story](#origin-story)
- [Architecture](#architecture)
- [Pages](#pages)
- [JavaScript Modules](#javascript-modules)
- [Data Files](#data-files)
- [Styling Architecture](#styling-architecture)
- [Firebase Setup](#firebase-setup)
- [LoveGPT — RAG Pipeline](#lovegpt--rag-pipeline)
- [Security](#security)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [File Tree](#file-tree)

---

## Overview

**Us Machina** is a multi-page romantic web application built with vanilla HTML, CSS, and JavaScript, bundled by Vite. It started as a creative "Will you be my girlfriend?" proposal site and evolved into a full relationship hub with a timeline, photo memories, Bible verse carousel, background music, and a personalized AI chatbot (LoveGPT) powered by Google Gemini and a custom RAG pipeline.

The backend uses **Firebase** (Firestore for data, Storage for images, Cloud Functions for the AI endpoint) on the Spark/Blaze plan.

---

## Origin Story

The site was originally created in September 2025 as a proposal. Emmanuel asked Tolu out by delivering a sermon on Proverbs 18:22, then directing her to a custom-coded website that revealed the question through a sparkle text animation. The site featured a "Yes" and "No" button — the "No" button playfully bounces around the screen to avoid being clicked.

After a successful proposal, the site was upgraded from a one-time artifact into a living relationship hub, rebranded from "ahosite" to **Us Machina** ("love in the machine").

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                     GitHub Pages                       │
│  (static hosting at k-sqr.github.io/lovesite/)        │
│                                                        │
│  index.html ──── src/main.js                           │
│  memories.html ─ src/memories.js                       │
│  timeline.html ─ src/timeline-page.js                  │
│  lovegpt.html ── src/lovegpt.js                        │
│                                                        │
│  Shared: src/modules/*.js  src/styles/*.css             │
│          src/data/*.js                                  │
└──────────────┬──────────────────────┬─────────────────┘
               │                      │
               ▼                      ▼
    ┌──────────────────┐   ┌──────────────────────────┐
    │  Firebase Client  │   │  Firebase Cloud Function  │
    │  (Firestore +     │   │  (LoveGPT endpoint)       │
    │   Storage +       │   │                            │
    │   Analytics)      │   │  Gemini 2.5 Flash API      │
    └──────────────────┘   │  + RAG knowledge base       │
                            └──────────────────────────┘
```

- **Build tool**: Vite (multi-page mode)
- **Language**: Vanilla JavaScript (ES modules), CSS3 custom properties
- **Hosting**: GitHub Pages via `gh-pages` npm package
- **Backend**: Firebase (Firestore, Storage, Cloud Functions 2nd gen)
- **AI**: Google Gemini 2.0 Flash via `@google/generative-ai`

---

## Pages ane skeleton

### `index.html` — Home / Proposal

The original proposal page and current landing page. Features:

- **Sparkle text reveal** — letter-by-letter animation asking the question, with a skip button
- **Yes / No buttons** — "Yes" triggers a graffiti celebration; "No" bounces around the screen through 15 zones, showing playful messages, then fades and shows "I still love you"
- **Response section** — appears after answering, shows a heartfelt message
- **Timeline preview** — 5 key milestones rendered as an interactive timeline
- **Photo gallery preview** — latest 6 memories from Firestore in a grid with lightbox
- **Bible verse carousel** — 33 curated verses with prev/next navigation
- **Background music** — toggle play/pause for a love song
- **Love counter** — live stopwatch showing months, days, hours, minutes, seconds since Sep 13, 2025
- **Floating hearts** — ambient animated hearts rising across the page

### `memories.html` — Photo Gallery

A dedicated page for browsing and uploading relationship photos.

- **Gallery grid** — all memories fetched from Firestore, displayed as cards
- **Lightbox** — click any photo to view full-size with caption
- **Upload panel** — drag-and-drop or file picker, client-side image compression (Canvas API), passcode-protected
- **Passcode modal** — SHA-256 hashed client-side, stored in `sessionStorage`

### `timeline.html` — Relationship Timeline

The full story of the relationship with stats and milestones.

- **Stats bar** — live counters for days together, months, and total milestones
- **Full timeline** — 18 detailed milestones from "The Sermon" through "Touchdown Winnipeg" with icons, dates, and descriptions
- **Dark mode support** — all cards respect the current theme

### `lovegpt.html` — LoveGPT Chat

A personalized AI chatbot page.

- **Starter pills** — pre-written question buttons to get started
- **Chat interface** — message bubbles (user: pink gradient, AI: glass card), typing indicator with animated dots
- **Cloud Function backend** — sends messages to the LoveGPT endpoint, receives AI responses
- **Conversation history** — maintained client-side, capped at 20 messages, sent with each request for context

---

## JavaScript Modules

All modules live in `src/modules/`. Each page imports only the modules it needs.

| Module | Purpose |
|--------|---------|
| `auth.js` | Passcode authentication for uploads. Hashes input with SHA-256 (Web Crypto API), compares against stored hash, persists auth state in `sessionStorage`. |
| `buttons.js` | Yes/No button behavior. "Yes" triggers celebration (graffiti rain, verse reveal, webhook). "No" detaches from its parent on first click, becomes `position: fixed` on `document.body`, bounces through 15 predefined zones (percentage-based), shows messages from `noTexts.js`, fades out after 15 clicks with a love message. |
| `firebase.js` | Initializes Firebase app, exports `db` (Firestore), `storage` (Storage), and analytics. Contains the project config object. |
| `gallery.js` | Home page gallery preview. Loads the 6 most recent memories from Firestore and renders them with lightbox support. |
| `graffiti.js` | Creates a "graffiti rain" celebration — hearts, emojis, and love phrases fall from the top of the screen when the user says "Yes". Uses `requestAnimationFrame` for smooth animation. |
| `loveCounter.js` | Live relationship duration counter. Calculates elapsed time from Sep 13, 2025 and updates every second showing months, days, hours, minutes, seconds. |
| `memoriesGallery.js` | Memories page gallery. Fetches all memories from Firestore, renders cards with safe DOM construction (no `innerHTML` for user content), sets up lightbox click handlers. Image URLs validated to require HTTPS. |
| `musicPlayer.js` | Background music toggle for the hero section. Play/pause with loop. |
| `navbar.js` | Sets the `active` class on the navigation link matching the current page path. |
| `textReveal.js` | Sparkle text reveal animation. Reveals text character-by-character with sparkle particle effects. Supports a skip button to complete instantly. |
| `theme.js` | Light/dark theme toggle. Uses `data-theme` attribute on `<html>`, persists choice in `localStorage`. Defaults to light mode on first visit. |
| `timeline.js` | Renders milestones from `milestones.js` data as a vertical timeline with icons, dates, titles, and descriptions. Supports both compact (5 items) and full (18 items) modes. |
| `upload.js` | Image upload to Firebase Storage. Compresses images client-side using Canvas API before uploading. Creates a Firestore document with URL, caption, timestamp, and the uploader's passcode hash. |
| `verses.js` | Bible verse carousel with prev/next navigation and floating verse overlay. Sources verses from `src/data/verses.js`. |
| `webhook.js` | Sends the Yes/No response to a configurable external URL (Formspree, Discord, etc.). |

---

## Data Files

All in `src/data/`:

| File | Contents |
|------|----------|
| `verses.js` | 33 Bible verses (`{ text, ref }`) curated for the relationship — 1 Corinthians 13, Song of Solomon, Romans, Isaiah, etc. Also exports `graffitiTexts` — an array of hearts, emojis, and love phrases used by the graffiti rain animation. |
| `milestones.js` | Two arrays: `mainMilestones` (5 key milestones for the home page preview) and `fullMilestones` (18 detailed milestones for the timeline page). Each entry has `date`, `title`, `desc`, and `icon`. Covers events from "The Sermon" (Sep 2025) to "Touchdown Winnipeg" (Feb 2026). |
| `noTexts.js` | 16 playful messages shown sequentially when the "No" button is clicked, e.g. "Are you sure?", "Pretty please?", "Abeg na!", "God said to say yes". |

---

## Styling Architecture

CSS uses custom properties for theming, `clamp()` for responsive typography, and `@keyframes` for all animations.

| File | Scope |
|------|-------|
| `base.css` | Root CSS variables (pink palette, card backgrounds, shadows, border radii), reset, body styles, typography (Dancing Script for headings, Inter for body), and `[data-theme="dark"]` overrides. |
| `sections.css` | Layout for all homepage sections (hero, response, timeline, gallery, verses, footer), navbar, buttons (including standalone `#noBtn` styles), lightbox, love counter, music toggle, locked sections, floating hearts, and mobile breakpoints. |
| `animations.css` | All `@keyframes`: `pulse`, `graffiti-fall`, `sparkle-anim`, `reveal`, `float-up`, `music-pulse`, `love-message`, `typingBounce`, `msgSlideIn`. Includes `prefers-reduced-motion` overrides. |
| `memories.css` | Memories page: upload panel, drag-and-drop zone, image preview list, progress bar, passcode modal, gallery grid, mobile adjustments. |
| `timeline-page.css` | Timeline page: stats bar with stat cards, extended timeline layout, responsive breakpoints. |
| `lovegpt.css` | LoveGPT page: subtle gradient background, sparkly header, starter pills, chat area, message bubbles (user: pink gradient, AI: glass card with `backdrop-filter`), typing dots animation, input area, custom scrollbar. |

### Theming

The site supports light and dark modes via the `data-theme` attribute on `<html>`:

- **Light mode** (default on first visit): warm pink/white palette
- **Dark mode**: deep navy/purple palette with adjusted shadows and card backgrounds
- Toggle is in the navbar; preference stored in `localStorage`

---

## Firebase Setup

### Project

- **Project ID**: `lovesite-1540e`
- **Config file**: `src/modules/firebase.js` (client-side Firebase config)
- **Project settings**: `.firebaserc` (alias mapping)

### Firestore

**Collection: `memories`**

Each document represents an uploaded photo:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Firebase Storage download URL |
| `caption` | string | User-provided caption (max 500 chars) |
| `createdAt` | timestamp | Upload timestamp |
| `passcodeHash` | string | SHA-256 hash of uploader's passcode |
| `filename` | string | Original filename |

**Security rules** (`firestore.rules`):
- Read: public (anyone can browse memories)
- Create: allowed if document has required fields and caption ≤ 500 chars
- Update/Delete: denied

### Storage

**Path: `memories/{fileName}`**

- Read: public
- Create: allowed for image files under 10 MB
- Update/Delete: denied

**Rules file**: `storage.rules`

### Cloud Functions

- **Runtime**: Node.js 20
- **Region**: us-central1
- **Function**: `lovegpt` — LoveGPT RAG endpoint (see below)
- **Memory**: 256 MiB
- **Source**: `functions/` directory

---

## LoveGPT — RAG Pipeline

LoveGPT is a personalized AI chatbot that answers questions about the relationship using a Retrieval-Augmented Generation (RAG) approach.

### Architecture

```
User question
    │
    ▼
┌─────────────────────┐
│  Keyword Extraction  │  ← stop-word filtering
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Chunk Retrieval     │  ← score by tag match (3x), section match (2x), content match (1x)
│  (top 8 chunks)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Context Building    │  ← format chunks with source labels
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Gemini 2.5 Flash    │  ← system prompt + context + user question + conversation history
└──────────┬──────────┘
           │
           ▼
      AI Response
```

### Knowledge Base

`functions/knowledge/chunks.json` contains 37 pre-processed chunks from three source documents:

1. **boo.pdf** (Emmanuel's notes) — food preferences, personality traits, relationship events, nicknames, spiritual notes
2. **journal.pdf** (Tolu's journal) — her perspective on the relationship, month-by-month entries
3. **Happy 180 Days** (anniversary letter) — detailed month-by-month recap from September 2025 to March 2026

Each chunk has:
- `id`: unique identifier
- `source`: `"emmanuel"` or `"tolu"`
- `section`: semantic category (e.g., `"food_preferences"`, `"september_2025"`)
- `tags`: array of keywords for scoring
- `content`: the actual text

### Retrieval Strategy

Instead of a vector database, retrieval uses keyword matching with weighted scoring:
- **Tag match**: 3 points per keyword
- **Section match**: 2 points per keyword
- **Content match**: 1 point per keyword

Top 8 chunks by score are returned. If no keywords are extracted, the first 5 chunks are used as default context.

### System Prompt

The system prompt defines LoveGPT's personality (warm, playful, faith-aware) and guidelines. Specific PII (birthdays, addresses, church names) has been removed from the system prompt — those details are only surfaced through RAG chunks when relevant to the question.

Security rules in the prompt prevent:
- Revealing system instructions
- Outputting HTML or executable code
- Fabricating events or quotes

### Gemini Integration

- **Model**: `gemini-2.0-flash`
- **API key**: stored as a Firebase secret (`GEMINI_API_KEY`), accessed via `process.env`
- **Conversation history**: validated and capped at 20 entries before forwarding to Gemini

---

## Security

### Content Security Policy

All 4 HTML pages include a `<meta>` CSP tag that restricts:
- **Scripts**: self only (no inline, no eval)
- **Styles**: self + unsafe-inline (needed for Vite-injected styles)
- **Images**: self + Firebase Storage
- **Connections**: self + Firebase APIs + Cloud Function endpoint + Google Analytics
- **Frames**: none

### CORS

The Cloud Function restricts CORS to:
- `https://k-sqr.github.io` (production)
- `http://localhost:5173` and `http://localhost:4173` (development)

### Input Validation (Cloud Function)

- Messages capped at 2,000 characters
- History capped at 20 entries
- Each history entry validated for shape (`role` must be `"user"` or `"assistant"`, `content` must be a string ≤ 2,000 chars)
- Non-POST requests rejected

### XSS Prevention

- **Memory captions**: rendered with `textContent` (not `innerHTML`)
- **Memory image URLs**: validated to require `https://` prefix
- **AI responses**: HTML-escaped before markdown formatting is applied
- **User messages in chat**: rendered with `textContent`

### Authentication

- Upload access: passcode-based, hashed client-side with SHA-256 (Web Crypto API)
- Auth state persisted in `sessionStorage` (clears when browser tab closes)

### Error Messages

The Cloud Function returns generic error messages to clients. Specific error details (missing API key, Gemini errors) are logged server-side only.

### Anti-Prompt Injection

The system prompt includes explicit instructions to never reveal its own instructions or output raw HTML/code.

### Firebase Security Rules

Version-controlled in `firestore.rules` and `storage.rules`:
- Memories are publicly readable
- Only valid image uploads under 10 MB are accepted
- No updates or deletes allowed
- All other paths are denied by default

---

## Deployment

### GitHub Pages (Frontend)

```bash
npm run deploy
```

This runs `vite build && gh-pages -d dist`, which:
1. Builds the Vite project to `dist/`
2. Pushes `dist/` to the `gh-pages` branch
3. GitHub Pages serves from `https://k-sqr.github.io/lovesite/`

### Firebase Cloud Functions

```bash
cd functions && npm install
npx firebase-tools deploy --only functions
```

Requires:
- Firebase CLI authenticated (`npx firebase-tools login`)
- `GEMINI_API_KEY` set as a Firebase secret:
  ```bash
  npx firebase-tools functions:secrets:set GEMINI_API_KEY
  ```

### Firebase Security Rules

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Firebase CLI (`npx firebase-tools`)
- A Firebase project with Firestore and Storage enabled

### Setup

```bash
git clone https://github.com/k-sqr/lovesite.git
cd lovesite
npm install
```

### Run Dev Server

```bash
npm run dev
```

Opens at `http://localhost:5173/lovesite/`. The Vite dev server provides hot module replacement.

### Preview Production Build

```bash
npm run build
npm run preview
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Firebase secret | Google Gemini API key for LoveGPT |
| Firebase config | `src/modules/firebase.js` | Client-side Firebase project configuration (public by design) |

### Functions Local Testing

```bash
cd functions
npm install
npx firebase-tools emulators:start --only functions
```

---

## File Tree

```
ahosite/
├── .firebaserc                  # Firebase project alias
├── .gitignore                   # Git ignore rules
├── DOCS.md                      # This file
├── FEATURES.md                  # Future feature ideas
├── README.md                    # Project readme
├── firebase.json                # Firebase config (functions, rules)
├── firestore.rules              # Firestore security rules
├── storage.rules                # Storage security rules
├── index.html                   # Home / proposal page
├── memories.html                # Photo gallery page
├── timeline.html                # Relationship timeline page
├── lovegpt.html                 # LoveGPT chat page
├── package.json                 # Root dependencies & scripts
├── vite.config.js               # Vite build config (multi-page)
├── src/
│   ├── main.js                  # Home page entry point
│   ├── memories.js              # Memories page entry point
│   ├── timeline-page.js         # Timeline page entry point
│   ├── lovegpt.js               # LoveGPT page entry point
│   ├── data/
│   │   ├── milestones.js        # Relationship milestones
│   │   ├── noTexts.js           # No-button messages
│   │   └── verses.js            # Bible verses & graffiti texts
│   ├── modules/
│   │   ├── auth.js              # Passcode auth
│   │   ├── buttons.js           # Yes/No button logic
│   │   ├── firebase.js          # Firebase init & config
│   │   ├── gallery.js           # Home gallery preview
│   │   ├── graffiti.js          # Heart/emoji rain animation
│   │   ├── loveCounter.js       # Live duration counter
│   │   ├── memoriesGallery.js   # Memories fetch, render, lightbox
│   │   ├── musicPlayer.js       # Background music toggle
│   │   ├── navbar.js            # Active nav link
│   │   ├── textReveal.js        # Sparkle text reveal
│   │   ├── theme.js             # Light/dark theme toggle
│   │   ├── timeline.js          # Timeline renderer
│   │   ├── upload.js            # Image upload + compression
│   │   ├── verses.js            # Verse carousel
│   │   └── webhook.js           # Response webhook
│   └── styles/
│       ├── animations.css       # All @keyframes
│       ├── base.css             # Variables, reset, typography
│       ├── lovegpt.css          # LoveGPT chat styles
│       ├── memories.css         # Memories page styles
│       ├── sections.css         # Homepage section layouts
│       └── timeline-page.css    # Timeline page styles
└── functions/
    ├── index.js                 # LoveGPT Cloud Function
    ├── package.json             # Function dependencies
    └── knowledge/
        └── chunks.json          # RAG knowledge base (37 chunks)
```
