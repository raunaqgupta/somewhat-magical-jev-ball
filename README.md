# Somewhat Magical Jev Ball

A Magic 8 Ball whose answers are decided by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.
Plain HTML/CSS/JS front end, following the Paper design; a small Cloudflare Worker calls Jev
server-side and relays live questions to other visitors.

Live at https://somewhatmagicaljevball.com

## Run

```sh
npm install
npm start   # wrangler dev, http://localhost:3210
npm test
```

## Deploy

`public/` is served as static assets and `src/worker.js` handles `/api/ask`
(`wrangler.jsonc`). The page also pings `/api/warm` once as a question starts being typed,
warming the model connection so a first answer lands inside the shake rather than a second
behind it. The custom domains, the `AI` binding, and a rate limit of 20 requests per
minute per IP are configured there.

```sh
npx wrangler login
npm run deploy
```

### Calling Jev

Jev is called as `typesafe/jev`, a model in [Workers AI's own catalog](https://developers.cloudflare.com/ai/models/typesafe/jev/),
through the `AI` binding (`env.AI.run(...)`, `wrangler.jsonc`'s `"ai": { "binding": "AI" }`,
`askJev` in `lib/decide.js`), routed through the `somewhat-magical-jev-ball` AI Gateway
(`GATEWAY_ID`) so its usage is logged there. Cloudflare bills this against the TypeSafe key added
to that gateway as a Bring Your Own Key — the Worker holds no TypeSafe key or secret of its own,
and none needs setting up to run this locally or deploy it. `wrangler dev` proxies the `AI`
binding to the real service even in local dev, so `npm start` calls the real Jev too.

(Cloudflare's separate AI Gateway *Universal Endpoint* BYOK — a raw HTTPS call to
`gateway.ai.cloudflare.com/v1/{account}/{gateway}/{provider}/...` — only proxies to
[a fixed list of providers](https://developers.cloudflare.com/ai-gateway/providers/) that
doesn't include TypeSafe; that was tried first and doesn't work. `typesafe/jev` in the Workers AI
catalog is a different, separate integration, and the one this app actually uses.)

## The layout

The page follows the Paper designs for a desktop (1280px wide, frame 7B-0) and a phone (370px wide,
frame 36-0). On a desktop it is a CSS grid of three columns (`1fr 421px 1fr`, the middle column's
two box lines included) and five rows (`1fr 71px 346px 118px 1fr`; the empty rows are never shorter
than a phone's safe areas, see below).
The title "Somewhat Magical Jev Ball" (`<header class="site-header">` with the page's `<h1>`), the ball
and the question box are the three cells of the middle column, and the empty
outer rows and columns take up what is left, so the stack is centred on the page. The ball's and
question box's cells have 36px of padding; the title sits 20px from its cell's top and 16px from its
bottom. The three cells sit on a `#fcfcfc` fill.

The lines are drawn by the cells themselves (their top edges, run out to both sides, and the column's
sides), so there are no extra elements for them. The column's two side lines are drawn as dashed
gradients (3px on, 3px off, as a 1px dashed border draws them) rather than as a dashed border,
because WebKit does not paint a dashed border's left edge at some widths (a 320px-wide iPhone's, where
the box starts 7.5px in), which left the page with only its right line. On a desktop they are dashed `#eeeeee` across the
page, and where they cross the middle column's box they are redrawn solid: the box's sides, the
title row's top edge and the question box's bottom edge are the darker `#aaaaaa` frame, and the
ball's and question box's top edges are `#eeeeee`.

On a phone (600px wide or less) it is the same grid, with **the same styling** (the same lines, box,
fill and type) and only the sizes and spacing that fit a narrow screen, as in frame 36-0: the ball is
179px instead of 273px, the title is 18px Ballet on a 22px line with 50px either side (instead of 24px
on a 34px line with 36px), the ball's and question box's cells have 16px at the sides, and the
question box's cell has 18px above and below it instead of 36px. The middle column is as wide as the
title and its 50px (about 305px) instead of 421px, with the empty columns taking the rest. The rows are
`1fr 59px 252px 82px 1fr`; the title's row grows if the title has to wrap, which it only does on
phones narrower than the title (about 305px). (Frame 36-0 draws the page-wide lines in a paler
`#f4f4f4`, and its cells clear; those are treated as differences in how the frame was drawn, not in
how the page looks on a phone.)

On a phone, dashed lines also run along the top and bottom of the viewport (the fixed background layer's
edges), marking where the page's visible area ends between the phone's status bar and toolbar: the middle
column's two lines start and stop there.

The page is drawn out to the very edges of a phone's screen (`viewport-fit=cover`), including behind
its notch, status bar and home bar; without it the browser lays the page out inside those and leaves
a band above and below where none of the grid's lines reach. The empty rows above and below the grid
are never shorter than `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`, so on a short
screen the grid still scrolls clear of them.

iOS Safari zooms the page in when a field whose text is under 16px is focused, and the question box's
text is the design's 14px. On iOS only, `public/viewport.js` adds `maximum-scale=1` to the viewport,
which stops that zoom without changing the type; iOS still lets people pinch-zoom. Other browsers do not
zoom on focus, so they are left as they are.

The window in the ball is the design's 149px on the desktop ball and 96px on the phone's (frame 36-0
draws it 96×95; the page takes it as a 96px circle). The ball's window is nearly flat dark grey
(`#474747` at 29% over black, blurred so wide that it covers the window evenly), as in the design — on
the phone's smaller window the same shadow covers it outright, which lands within 1/255 of the same
grey.

The lines run out 100vw past their cells, so `html` and `body` are set so that the body clips them
(`overflow-x: clip` only works on the body if the page's own overflow is not `visible`); otherwise the
page would scroll sideways.

The title's script face, Ballet, is served from this site (`public/fonts/`, the Latin subset as WOFF2,
preloaded), not from Google Fonts, so the page makes no third-party request for it. It is licensed under
the SIL Open Font License 1.1, and its license and copyright notice ship alongside it. If the font cannot
load, the title shows in the system font.

The question box's text is Hyperlegible Sans Regular, as in the designs, served from this site in the
same way (Latin subset, WOFF2, preloaded, its SIL Open Font License 1.1 alongside it). Other scripts,
and the box while the font loads, use the system font.

## The 3D ball

The ball is a sphere rendered with [three.js](https://threejs.org) (`public/ball3d.js`).
The answer window stays a DOM element on top of the canvas so the text is real text, and the whole
ball shakes with a CSS animation when you ask. If WebGL is unavailable the flat CSS ball is used instead,
with a subtle radial highlight of its own so it still reads as round rather than a flat disc.

The sphere is low-poly and flat-shaded, in `MeshPhongMaterial`, lit by two point lights taken from
three.js's own `webgl_effects_ascii` example — a brighter one and a dimmer fill in opposite corners —
so the faceted sphere shades toward its edge and catches a broad, faint highlight. Each channel of the
render is quantized to a handful of levels through a visible ordered (Bayer) dither, the classic
stippled, retro look, and the whole thing is tone-mapped with ACES so the highlights roll off softly
instead of clipping to white. The two faces are caps of the same sphere, as wide as the design's
window on that ball (149px of the desktop's 273px ball, 96px of the phone's 179px one), drawn from the
same measurements (`public/face-texture.js`).

three.js is bundled down to just the classes used (`src/three-entry.js`) into `public/vendor/three.js`,
which is committed, so there is no build step to run the app. After changing the entry or upgrading
three, regenerate it with `npm run vendor:three`.

## Rotating the ball

The ball has a front and a back (Paper designs "front" and the ball's back). The front is the dark
window with the answer; the back is a white window reading `jev 1.13`, the model version.

The ball is a 3D model (`public/ball3d.js`): a sphere with both faces on it as part of the
model, lit by the scene's two point lights and finished like the sphere itself (flat-shaded,
dithered), so they turn with it and **text goes upside down when the ball is flipped over**, as a label
on a real ball would. The faces are drawn from the same measurements as the designs
(`public/face-texture.js`). The answer stays real text in the page for screen readers, and the front
face is redrawn from it whenever it changes.

Drag the ball with a mouse or a finger to rotate it, in any direction: it turns like a trackball, so
the surface follows the pointer from whatever orientation it is in, and half a turn in any direction
shows the back. When you let go the ball rotates back to rest over 800ms about a single axis by the
short way, fast at first and slowing down (ease-out cubic). Catching it mid-return picks it up
again. With `prefers-reduced-motion` it snaps back instead.

**Pressing does nothing by itself.** The ball reacts only once a *click* has fully registered, meaning a press let go
without having been dragged (a drag turns the ball instead, and a long hold that is released still counts as a click).

**Clicking** the ball pushes it back into the page: it eases out to 90% (100ms: quick, then settling) and then
eases in and out back to full size (slower, 600ms: slow to start, quickest in the middle, slowing again as it arrives). Because a click might be the first half of a double click, the push waits 0.15 seconds to see whether a
second press begins.

**Double-clicking** the ball pushes it back **and** spins it one full turn about its vertical axis at the same
moment, over a second, front moving right first, showing the back face half way round; it ends exactly where it
began (or carries on to rest if it was still returning). The single click's own, earlier push does not happen: the
push begins with the spin, so there is one push, not two. A double click is a second press that *begins* within 0.15
seconds of the first click being let go and within 30px of it, and is itself let go without a drag (how long it is
held does not matter). It is worked out from pointer events so a mouse and a finger behave the same. A drag in
between, or a second press that begins later or further away, is not a double click. People who ask for reduced
motion get neither the push nor the spin. The rules are in `public/click.js` (`DOUBLE_CLICK_MS` sets the 0.15s).

If WebGL is unavailable the flat ball is used, and its two windows are moved and turned around it
with the same geometry (`public/ball-math.js`), so the text still flips. Pointer handling is in
`public/ball-rotate.js`.

## The live background

Questions asked by any visitor drift across the background of everyone else's page as faint,
dashed pills, at random positions and sizes so they read as having depth, then fade away
(`public/background.js`, layout rules in `public/blurb-layout.js`).

- A `Feed` Durable Object (`src/worker.js`) holds one WebSocket per visitor at `/api/feed` and
  relays each question to all of them. **Nothing is stored**: a question is only seen by visitors
  who are connected when it is asked.
- **When the site is quiet**, so that the background is not empty, a built-in list of 1000 yes or
  no questions (`public/idle-questions.js`, all generic and none personal) drifts through it
  instead. Once no question from another visitor has arrived for 8 seconds, one appears every 2.5
  to 6 seconds, until a real one arrives, which stops them again. They also fill the background if
  the feed is unavailable. They come in a random order, each once before any is repeated, and the
  list is only downloaded when the first one is needed (`public/idle-feed.js` has the timing and
  the shuffling).
- Questions containing private personal information (a private individual's name, phone number,
  email or home address) are answered but never shown to others. This is the `personal` noul,
  scored in the same Jev request, hidden above `PERSONAL_THRESHOLD` (0.3). Offensive questions are
  not filtered.
- A visitor never sees their own questions. Each browser has a random id kept in `localStorage`
  (shared by its tabs), sent when it connects and when it asks; the server skips that browser's
  connections when relaying its question. The id is never sent to other visitors. Someone using
  a second browser or device, or who clears their storage, is a new visitor and will see them.
- Question text is only ever inserted as plain text. WebSocket connections are limited to 20 a
  minute per IP.

## How a decision is made

Each question is sent to Jev once, with twelve independent yes/no (noul) judgments
(`lib/decide.js`). Code then combines them into one of the 20 canonical answers
(`lib/answers.js`, from [Wikipedia](https://en.wikipedia.org/wiki/Magic_8_Ball#Possible_answers)):

| Signal | Role |
| --- | --- |
| `fact`, `truth` | `fact` (above 0.8, `FACT_THRESHOLD`) says the question is about a fact; only then is `truth` used. Above 0.75 (`TRUTH_JUDGMENT`) the answer is affirmative, below 0.25 negative, as emphatic as `certain`. In between, and for opinions and predictions, the rules below decide |
| `personal` | Does not change the answer; above 0.3 the question is kept out of the live background |
| `snarky` | Above 0.50: "Don't count on it", whatever the question asks |
| `selfDeprecating` | Above 0.50: "As I see it, yes", whatever the question asks |
| `favorable`, `certain` | Direction and strength: pick from 10 affirmative or 5 negative answers, most to least emphatic |
| `hazy`, `later`, `unwelcome`, `unpredictable` | Each selects one non-committal answer when the yes/no lean is weak |
| `unfocused` | Not a real yes/no question: "Concentrate and ask again" |

The rules run in this order: tone (snark wins if both fire), then non-questions, then `fact` and `truth`, then hedging, then the yes/no lean. Thresholds (`HEDGE_THRESHOLD`, `UNFOCUSED_THRESHOLD`) were tuned by hand on a small
set of sample questions, not against labeled data.
