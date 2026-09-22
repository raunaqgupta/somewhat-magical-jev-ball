# Somewhat Magical Jev Ball

A Magic 8 Ball whose answers are decided by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.
Plain HTML/CSS/JS front end, following the Paper design; a small Cloudflare Worker keeps the API key off the browser.

Live at https://somewhatmagicaljevball.com

## Run

```sh
npm install
cp .dev.vars.example .dev.vars   # then add your TYPESAFE_API_KEY
npm start                        # wrangler dev, http://localhost:3210
npm test
```

## Deploy

`public/` is served as static assets and `src/worker.js` handles `/api/ask`
(`wrangler.jsonc`). The custom domains and a rate limit of 20 requests per minute per IP
are configured there.

```sh
npx wrangler login
npx wrangler secret put TYPESAFE_API_KEY   # once, until the AI Gateway token is set (see below)
npm run deploy
```

### Calling TypeSafe through Cloudflare AI Gateway

TypeSafe is called through an AI Gateway (`somewhat-magical-jev-ball`, `wrangler.jsonc`'s
`AI_GATEWAY_BASE_URL`), which holds the real TypeSafe key itself as a Bring Your Own Key, so the
Worker never has to. Reaching the gateway needs its own auth, the `CF_AI_GATEWAY_TOKEN` secret
(the gateway's `cf-aig-authorization` token, from its settings in the dashboard) — set it the
same way:

```sh
npx wrangler secret put CF_AI_GATEWAY_TOKEN   # once
```

Until that secret is set, `askJev` falls back to calling TypeSafe directly with
`TYPESAFE_API_KEY` (see `jevConfig` in `lib/decide.js`), so deploying this is safe before the
token is in place. Once it is set, `TYPESAFE_API_KEY` is no longer read and the Worker's own copy
of it can be removed with `npx wrangler secret delete TYPESAFE_API_KEY`.

## The layout

The page follows the Paper designs for a desktop (1280px wide) and a phone (370px wide). On a
desktop it is a CSS grid of three columns (`1fr 420px 1fr`) and five rows (`1fr 63px 346px 118px 1fr`).
The title "Somewhat Magical Jev Ball" (`<header class="site-header">` with the page's `<h1>`), the ball
and the question box are the three cells of the middle column, each with 36px of padding, and the empty
outer rows and columns take up what is left, so the stack is centred on the page. Faint lines (`#f4f4f4`)
run between the cells across the whole page, and the middle column's box is drawn in `#cccccc`. The cells
draw these lines themselves (their top edges, run out to both sides, and the column's sides), so there
are no extra elements for them.

On a phone (600px wide or less) it is the same grid with different sizes: the ball is 179px instead of
273px, the cells have 16px at the sides, and the middle column is as wide as the title (about 300px)
instead of 420px, with the empty columns taking the rest. The rows are `1fr 63px 252px 118px 1fr`; the
title's row grows if the title has to wrap, which it only does on phones narrower than the title (about
300px). The window in the ball is 149px on both. The ball's window is nearly flat dark grey (`#474747`
at 29% over black, blurred so wide that it covers the window evenly), as in the design.

The lines run out 100vw past their cells, so `html` and `body` are set so that the body clips them
(`overflow-x: clip` only works on the body if the page's own overflow is not `visible`); otherwise the
page would scroll sideways.

The title's script face, Ballet, is served from this site (`public/fonts/`, the Latin subset as WOFF2,
preloaded), not from Google Fonts, so the page makes no third-party request for it. It is licensed under
the SIL Open Font License 1.1, and its license and copyright notice ship alongside it. If the font cannot
load, the title shows in the system font.

## The 3D ball

The ball is a sphere rendered with [three.js](https://threejs.org) (`public/ball3d.js`).
The answer window stays a DOM element on top of the canvas so the text is real text, and the whole
ball shakes with a CSS animation when you ask. If WebGL is unavailable the flat CSS ball is used instead.

three.js is bundled down to just the classes used (`src/three-entry.js`) into `public/vendor/three.js`,
which is committed, so there is no build step to run the app. After changing the entry or upgrading
three, regenerate it with `npm run vendor:three`.

## Rotating the ball

The ball has a front and a back (Paper designs "front" and the ball's back). The front is the dark
window with the answer; the back is a white window reading `jev 1.13`, the model version.

The ball is a 3D model (`public/ball3d.js`): a sphere with both faces on it as part of the
model, all lit by a single ambient light (so each face shows in its own colours from whichever way
it is turned, with no shading or highlights), so they turn with it and **text goes upside down when the ball is flipped over**, as a label
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
  who are connected when it is asked, and the background is empty when the site is quiet.
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
