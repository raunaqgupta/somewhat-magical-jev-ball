# Magic Jev Ball

A Magic 8 Ball whose answers are decided by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.
Plain HTML/CSS/JS front end, following the Paper design; a small Cloudflare Worker keeps the API key off the browser.

Live at https://magicjevball.raunaqgupta.com

## Run

```sh
npm install
cp .dev.vars.example .dev.vars   # then add your TYPESAFE_API_KEY
npm start                        # wrangler dev, http://localhost:3210
npm test
```

## Deploy

`public/` is served as static assets and `src/worker.js` handles `/api/ask`
(`wrangler.jsonc`). The custom domain and a rate limit of 20 requests per minute per IP
are configured there.

```sh
npx wrangler login
npx wrangler secret put TYPESAFE_API_KEY   # once
npm run deploy
```

## The 3D ball

The ball is a glossy sphere rendered with [three.js](https://threejs.org) (`public/ball3d.js`).
The answer window stays a DOM element on top of the canvas so the text is real text, and the whole
ball shakes with a CSS animation when you ask. If WebGL is unavailable the flat CSS ball is used instead.

three.js is bundled down to just the classes used (`src/three-entry.js`) into `public/vendor/three.js`,
which is committed, so there is no build step to run the app. After changing the entry or upgrading
three, regenerate it with `npm run vendor:three`.

## How a decision is made

Each question is sent to Jev once, with ten independent yes/no (noul) judgments
(`lib/decide.js`). Code then combines them into one of the 20 canonical answers
(`lib/answers.js`, from [Wikipedia](https://en.wikipedia.org/wiki/Magic_8_Ball#Possible_answers)):

| Signal | Role |
| --- | --- |
| `truth` | Is the answer factually true? Above 0.75 (`TRUTH_JUDGMENT`): an affirmative answer; below 0.25: a negative one; as emphatic as `certain`. In between, the rules below decide |
| `snarky` | Above 0.50: "Don't count on it", whatever the question asks |
| `selfDeprecating` | Above 0.50: "As I see it, yes", whatever the question asks |
| `favorable`, `certain` | Direction and strength: pick from 10 affirmative or 5 negative answers, most to least emphatic |
| `hazy`, `later`, `unwelcome`, `unpredictable` | Each selects one non-committal answer when the yes/no lean is weak |
| `unfocused` | Not a real yes/no question: "Concentrate and ask again" |

The rules run in this order: tone (snark wins if both fire), then non-questions, then `truth`, then hedging, then the yes/no lean. Thresholds (`HEDGE_THRESHOLD`, `UNFOCUSED_THRESHOLD`) were tuned by hand on a small
set of sample questions, not against labeled data.
