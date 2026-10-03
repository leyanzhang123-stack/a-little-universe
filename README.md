# A Little Universe

A single-page, scroll-through birthday site. No framework, no build step to
view it, no external requests. Open `index.html` and it runs, including with
the network switched off.

**This repository is the public demo build.** Every name, photo and line of
copy is fictional. The images are drawn in code by
`tools/make-demo-photos.py`; there is no real photography here, and no audio
or video, to stay clear of licensing.

## Why it is built this way

It had to be deliverable to one person on a phone, in China, possibly on a
bad connection, possibly with no connection at all. That ruled out most of
the obvious choices and drove nearly every decision below:

- **No CDN, no Google Fonts, no analytics.** Nothing the page needs comes
  from a third party, so nothing breaks behind the GFW or on a plane.
- **One HTML file has to be a valid delivery format**, because sending a
  file through a chat app is more reliable than asking someone to open a
  link.
- **It has to survive being opened in an in-app browser**, which is where
  most links actually get opened.

## Running it

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

Or just double-click `index.html`.

## The three builds

```bash
python3 tools/build-preview.py     # -> dist/preview.html        one file, Google Fonts, for a quick preview link
python3 tools/build-site.py        # -> dist/site/ + a zip       for static hosting (recommended)
python3 tools/build-standalone.py  # -> dist/standalone.html     one file, fully offline
```

`build-site` emits a folder you can drag onto any static host. Assets stay
separate and load on demand, so the first screen arrives quickly.

`build-standalone` inlines everything (fonts, images, audio, video) as data
URIs into a single HTML file. Fonts are re-subset and media re-compressed on
the way in. With real photographs this lands around 20MB, which a chat app
will carry as a file attachment.

## Font subsetting

Fonts are subset to exactly the characters the page uses, by scanning
`content.js`, `index.html` and `main.js` at build time.

| | bundled | after subsetting |
|---|---|---|
| all faces | 1.7MB | 62KB |

The bundled set covers the 3755 most common Chinese characters plus every
character appearing in the copy. The demo is English-only, so the CJK faces
subset down much further than they would with real Chinese content. Write an
unusual character and it falls back to a system font rather than rendering
as a blank box.

| role | face |
|---|---|
| Latin headings | Cormorant Garamond |
| CJK headings | Noto Serif SC |
| body / letter | LXGW WenKai |
| small labels | DM Mono |

Korean gets its own 6.8KB subset of Noto Sans KR with `unicode-range` pinned
to Hangul, because none of the other bundled faces carry a single Hangul
glyph and it would otherwise tofu out on some Android ROMs.

## Editing the content

**Only `content.js` needs to change.** It is one commented file holding every
string, image path and section of the site. The engine reads it and builds
everything else. Someone who does not write code can edit it.

```js
{ src: 'photos/timeline/01.jpg', date: 'summer 2021',
  title: 'That long walk', text: 'The road was genuinely long.' }
```

Add a row to add a memory, delete a row to remove one. Set `quizzes: []` to
drop the quiz mechanic entirely. Leave `music.src` empty and the audio
toggle never appears.

Photos go through `tools/prep-photos.py`, which orders them by capture time,
converts to JPEG, resizes, and strips EXIF including GPS.

## Structure

The site is one page, seven sections, with the colour temperature shifting
between them as you scroll: night for the prologue, then cream, pale sky,
soft violet, warm beige and dusk violet.

1. **Prelude** — loading, `ENTER`
2. **Prologue** — light eighteen candles to light the cake. Night fades to
   day on entry.
3. **Hero** — name, date range, live countdown
4. **Memories** — a photo timeline with quiz gates. Later entries stay
   blurred until the question is answered.
5. **Meals** — flip cards
6. **Childhood** — a polaroid wall, likes remembered per browser
7. **Song / Letter / Ending** — blow out the candles to finish. Three taps
   on the moon reveal a hidden line.

## Interaction and accessibility

- Background audio starts on the `ENTER` click, because browsers refuse to
  autoplay. It ducks under the song section and lifts afterwards.
- Video carries the X5 attributes that stop the WeChat and QQ Android
  browsers from hijacking it into a fullscreen system player.
- Mobile tested: enlarged touch targets, safe-area insets, zero horizontal
  scroll.
- `prefers-reduced-motion` collapses the animation; all content still shows.
- Gyroscope parallax asks permission once on mobile and degrades silently if
  refused.
- The candles are real buttons, reachable by keyboard and screen reader.

## Licence

The code is free to reuse. The fonts keep their own licences: Cormorant
Garamond, Noto Serif SC and Noto Sans KR are OFL, LXGW WenKai is OFL, DM
Mono is OFL.
