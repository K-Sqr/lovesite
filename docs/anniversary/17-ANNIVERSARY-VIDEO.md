# 17 — The Anniversary Video

> One short, cute video of the year, with music, hidden behind a very quiet link on the
> **One Year** card of Our Story. The fastest path that actually finishes, not the most polished one.

**Owner:** Emmanuel. **Tooling:** CapCut desktop (free), then Claude Code for the site side.
**Timebox:** one evening for the cut, one sitting for the wiring. If it is taking longer than that,
the video is too long — cut media, not corners.

---

## The verdict on the media

**150 photos + 30 videos is far too much for one video, and that is fine — it is a shortlist, not
a storyboard.** A watchable anniversary video is **3–4 minutes**: the length of one song. At that
length there is room for roughly:

| | Count | On screen |
|---|---|---|
| Photos | 40–55 | 3–4 s each |
| Video clips | 8–12 | 4–8 s each, trimmed hard |
| **Total** | **~50–65 items** | **~3:30** |

So you will use about a third of what you set aside, not half. Anything longer than four minutes
stops being cute and starts being a slideshow she politely sits through. The song decides the
length; the media fills it. Never the other way round.

**Cull rule (the only one that matters): one item per moment.** The timeline already lists the
moments (`src/data/timeline.js`) — walk it top to bottom and pick the single best photo or clip
for each entry that has one. Then add a handful of "no reason, just us" shots between them. If two
photos are of the same afternoon, one goes.

## Tool: CapCut, not Canva

Use **CapCut desktop** (free, Windows). Not the phone app, not the browser version.

Why it wins for this exact job:

- **No 21-item limit.** That cap belonged to Canva's slideshow app, not Canva itself, but the
  ordinary Canva video editor is slow with 60 items and its free MP4 export is a 1080p landscape-only
  affair anyway.
- **Mixed orientation is a one-click fix**, not a wall. Vertical photo in a landscape frame (or
  vice versa) → right-click the clip → *Background* → *Blur*. Every clip fills the frame with a soft
  blurred copy of itself behind it. This is the single feature Canva's slideshow lacked and it is
  the whole reason to switch.
- **Free export at 1080p with no watermark.** CapCut adds an optional outro clip at the end of the
  timeline — delete it before export. No trial, nothing to cancel.
- **Imports your own MP3** for the soundtrack (see Music below).

Do not use the trial-and-cancel route on Canva; it buys you nothing CapCut does not give you free.

## Orientation decision

Pick **one** frame for the whole video before importing anything:

- **9:16 vertical** if most of the media is vertical (phone photos usually are) — recommended. She
  will watch it on her phone, and the site opens it in a modal that fits either shape.
- **16:9 landscape** only if the good video clips are mostly landscape.

Whichever loses gets the blur background. Do not mix frames; do not try to rotate anything.

## Music

Use one of the songs already on the site (`public/music/`) — the one that is *yours*. The site
plays it on every page, so the video sounding like the site is the point. Drag the MP3 into CapCut,
trim it to fade out at ~3:30 (*Audio* → *Fade out*, 3 s), and build the cut to that length.

The file will be hosted on your own site, not YouTube or Instagram, so there is no copyright
matching to worry about. Do not upload it anywhere public.

## The cut — step by step

1. **Gather** everything into one local folder, `anniversary-video/raw/`. OneDrive and Canva
   exports go there too. Do this first so the cull happens in one place.
2. **Cull** into `anniversary-video/pick/`, renaming as you go so they sort in story order:
   `01-confession.jpg`, `02-she-said-yes.mp4`, `03-…`. Sixty files, max. 60–90 minutes, timed.
3. **CapCut:** New project → set the frame (9:16 or 16:9) → *Import* the `pick/` folder → select all
   → drag to the timeline. They land in filename order.
4. Select all clips → set photo duration to **3.5 s** (*Duration* on the right panel applies to the
   selection). Trim each video clip to its best 4–8 seconds — be ruthless.
5. Select all → *Background* → *Blur* (applies to every mismatched clip at once).
6. Drop the MP3 on the audio track. Trim the *end* of the visuals to the fade-out, not the song to
   the visuals.
7. Optional, ten minutes, no more: one *Transition* (*Dissolve*, 0.3 s, "apply to all"), one title
   card at the start ("One year." — same words as the card), one at the end ("Here's to the next
   one." or whatever you'd actually say). No stickers, no effects, no captions on every photo.
8. Delete the CapCut outro clip. **Export:** 1080p, 30 fps, H.264, *bitrate: recommended*.
   Target **under 100 MB**; if it comes out bigger, export at 720p instead — on a phone nobody can
   tell. Name it `anniversary-2026.mp4`.
9. Export one still from a good frame as `anniversary-2026-poster.jpg` (*Export* → *Frame*). This
   is the thumbnail the site shows before play.

## Hosting the file

**Firebase Storage, not the git repo.** The repo already carries 53 MB of music; a 100 MB video
would blow past GitHub's 100 MB file limit and bloat every clone forever. Storage is already the
home of the letters (`storage.rules`) and the free tier (5 GB, 1 GB/day download) is more than a
video watched by two people needs.

- Upload through the Firebase console to `videos/anniversary-2026.mp4` and the poster to
  `videos/anniversary-2026-poster.jpg`.
- Add a `videos/` block to `storage.rules` mirroring the `letters/` one: public read, owner-only
  write, `video/mp4` and `image/jpeg` only. Public read is deliberate for the same reason the
  letters are: multi-MB media must stream, and the link is only ever shown on Our Story.
- The URL is the same shape `letterSource.js` builds:
  `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/videos%2Fanniversary-2026.mp4?alt=media`.
- **CSP:** `media-src` is currently `'self'` on every page. Add
  `https://firebasestorage.googleapis.com` to `media-src` in the CSP `<meta>` of **every** HTML file
  (they must stay identical — `PAGE-CHECKLIST.md` step 5) and record it in `DOCS.md` → Security.

## The link on the One Year card

Everything below is a Claude Code job once the file is hosted. Hand it this section.

**Data.** One new optional field on a timeline entry, used only by `one-year` for now:

```js
video: {
  src: 'https://firebasestorage.googleapis.com/v0/b/…/o/videos%2Fanniversary-2026.mp4?alt=media',
  poster: 'https://…/videos%2Fanniversary-2026-poster.jpg?alt=media',
  label: 'click me',            // the link text — see below
  title: 'One year, in three and a half minutes',
},
```

**The link.** In `src/modules/timeline.js` `renderEntry()`, full variant only, after the
description and before photos: a single inline `<a>` (or `<button>`) with class `timeline-video-link`.
Styling: body font, `0.8rem`, `--text-muted`, **underlined with `text-decoration-color` at ~40%
opacity and a 3px underline offset**, no icon, no arrow. It should read as an afterthought, not a
call to action. On hover the underline goes solid. That is the whole treatment.

Link text candidates (owner picks one; all lower-case on purpose):
- `click me`
- `there's something here`
- `press play, baby girl`
- `for you ♥`

**The player.** Clicking opens the existing modal primitive (`.usm-modal` from `ui.css`, focus and
Escape via `src/modules/modal.js`) containing one `<video controls playsinline preload="none">`
with the poster. Rules:
- `preload="none"` — the 100 MB never downloads unless she presses play.
- Pause the site music when the video starts (`musicPlayer.js` exposes the audio element as
  `#bgMusic`; pause it on `play`, leave it paused after — do not auto-resume over the ending).
- Closing the modal pauses and unloads the video (`video.pause(); video.removeAttribute('src');
  video.load()`), same discipline as the letters reader revoking its blob URL.
- On the home-page preview variant the link does not render at all. It belongs to the full story.
- Reduced motion changes nothing here; it's a video she chooses to press play on.
- No autoplay, no sound before she asks for it, no confetti on open — the celebration on that card
  already exists (`celebrate.js`); the video is quieter than that on purpose.

**Fallback.** If the modal fails for any reason the `<a href>` points straight at the MP4, which
every phone browser plays natively. Progressive by default.

## Checklist

- [ ] Media gathered into one folder; culled to ≤ 60 files in story order
- [ ] Frame chosen (9:16 or 16:9), blur background applied to the rest
- [ ] Song picked from `public/music/`, video cut to its fade-out (~3:30)
- [ ] CapCut outro deleted; exported 1080p (or 720p), under 100 MB, plus a poster JPG
- [ ] Uploaded to Storage under `videos/`; `storage.rules` block added and deployed
- [ ] `media-src` updated in every HTML file; `DOCS.md` Security updated
- [ ] `video` field on the `one-year` entry; link text chosen
- [ ] Link renders only on the full timeline, underlined quietly, opens the modal player
- [ ] Site music pauses on play; video unloads on close
- [ ] Checked on her phone at 375px, on cellular, before she is shown it

## Decisions for the owner

1. **Frame:** 9:16 or 16:9? (Recommended: 9:16.)
2. **Song:** which track from `public/music/`?
3. **Link text:** which of the four above, or your own?
4. **Poster frame:** which moment is the thumbnail she sees before pressing play?

---

## The 40-minute version — YouTube link, no hosting, no player

Everything above is the proper build. **If there are 30–40 minutes from a blank CapCut project to
the link being live, do this instead.** It drops Firebase Storage, the CSP change, the modal and
the poster. The link on the One Year card simply opens the video in a new tab.

### YouTube vs OneDrive — YouTube, unlisted

| | YouTube (unlisted) | OneDrive share link |
|---|---|---|
| Opens on her phone | In the YouTube app, instantly, full-screen, streams properly | OneDrive web viewer; sometimes nags to sign in or install the app, buffers a 100 MB file |
| Time to be ready | Upload ~2 min + processing ~3–5 min for a 3-minute 1080p file | Upload ~2 min, playable as soon as it lands |
| Site changes needed | **None.** Plain `<a href target="_blank">` — no CSP edit, no embed | Same |
| Risk | The song can trip Content ID. Unlisted uploads with a claimed song are usually still playable (the claim adds ads or a credit); a hard block is rare but possible | None on copyright; the risk is the clunky viewer |

**Go YouTube unlisted.** Upload it *first*, and check the "Copyright" column on the Studio upload
screen before closing the tab. If it says anything other than "No issues found", open the video on
your phone — if it plays, you're fine; if it's blocked, upload the same file to OneDrive, *Share* →
*Anyone with the link* → *Copy link*, and use that instead. Either way the site change is one
string.

Do **not** embed a YouTube iframe on the card. `frame-src` is `'none'` on every page, so an embed
means editing the CSP in every HTML file and testing it — that is the thing there isn't time for.
A link that opens a new tab needs nothing.

### The clock

| Minutes | Do |
|---|---|
| 0–8 | **Cull to ~25 items, not 60.** 15–18 photos, 6–8 clips. Copy them into one folder named in story order. Stop at eight minutes even if it isn't perfect. |
| 8–22 | **CapCut:** 9:16 frame → import folder → select all → drag in. Select all → duration 3.5 s → *Background → Blur*. Trim each clip to ~5 s. Drop the song in, fade out 3 s at the end of the last clip (~2:15 for 25 items — shorter is better today). One title card: "One year." Delete the outro. |
| 22–27 | **Export** 1080p 30 fps. Keep the tab open while it renders. |
| 27–30 | **Upload to YouTube** as *Unlisted* (title "One year", nothing else). Copy the `youtu.be/…` link from the upload dialog as soon as it appears — processing finishes in the background. |
| 30–35 | **Wire the link** (below) — Claude Code, with the URL pasted in. Commit, push, `npm run deploy`. |
| 35–40 | Open Our Story on your phone, tap the link, confirm it plays. Done. |

If step one is taking longer than eight minutes, you are picking, not culling. Grab the first
decent shot of each moment and move on.

### The site change (one field, one link)

**Data** — on the `one-year` entry in `src/data/timeline.js`:

```js
video: { href: 'https://youtu.be/XXXXXXXXXXX', label: 'click me' },
```

**Render** — in `renderEntry()` in `src/modules/timeline.js`, full variant only, after the
description:

```js
if (variant === 'full' && entry.video) {
  const link = el('a', 'timeline-video-link', entry.video.label);
  link.href = entry.video.href;
  link.target = '_blank';
  link.rel = 'noopener';
  node.appendChild(link);
}
```

**Style** — in `src/styles/timeline-page.css`, next to the other one-year affordances: inline,
body font, `0.8rem`, `color: var(--text-muted)`, `text-decoration: underline`,
`text-decoration-color` at ~40 % opacity, `text-underline-offset: 3px`, solid underline on hover
and `:focus-visible`. No icon, no arrow, no new colour. Lower-case label. It should look like an
afterthought that only someone reading closely would tap.

That is the entire change — three files, ~15 lines, no new hosts, nothing to test but the tap.
When there is a free evening later, the modal player and Firebase Storage version above can
replace it without touching the data shape beyond swapping `href` for `src`.
