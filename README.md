# Magic Jev Ball

A Magic 8 Ball whose answers are decided by [Jev](https://docs.typesafe.ai), TypeSafe's System One model.
Plain HTML/CSS/JS front end, following the Paper design; a small dependency-free Node server keeps the API key off the browser.

## Run

```sh
npm install
cp .env.example .env   # then add your TYPESAFE_API_KEY
npm start              # http://localhost:3210
npm test
```

## How a decision is made

Each question is sent to Jev once, with nine independent yes/no (noul) judgments
(`lib/decide.js`). Code then combines them into one of the 20 canonical answers
(`lib/answers.js`, from [Wikipedia](https://en.wikipedia.org/wiki/Magic_8_Ball#Possible_answers)):

| Signal | Role |
| --- | --- |
| `snarky` | Above 0.50: "Don't count on it", whatever the question asks |
| `selfDeprecating` | Above 0.50: "As I see it, yes", whatever the question asks |
| `favorable`, `certain` | Direction and strength: pick from 10 affirmative or 5 negative answers, most to least emphatic |
| `hazy`, `later`, `unwelcome`, `unpredictable` | Each selects one non-committal answer when the yes/no lean is weak |
| `unfocused` | Not a real yes/no question: "Concentrate and ask again" |

The tone signals are checked first (snark wins if both fire). Thresholds (`HEDGE_THRESHOLD`, `UNFOCUSED_THRESHOLD`) were tuned by hand on a small
set of sample questions, not against labeled data.
