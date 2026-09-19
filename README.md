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

Each question is sent to Jev once, with seven independent yes/no (noul) judgments
(`lib/decide.js`). Code then combines them into one of the 20 canonical answers
(`lib/answers.js`, from [Wikipedia](https://en.wikipedia.org/wiki/Magic_8_Ball#Possible_answers)):

| Signal | Role |
| --- | --- |
| `favorable`, `certain` | Direction and strength: pick from 10 affirmative or 5 negative answers, most to least emphatic |
| `hazy`, `later`, `unwelcome`, `unpredictable` | Each selects one non-committal answer when the yes/no lean is weak |
| `unfocused` | Not a real yes/no question: "Concentrate and ask again" |

Thresholds (`HEDGE_THRESHOLD`, `UNFOCUSED_THRESHOLD`) were tuned by hand on a small
set of sample questions, not against labeled data.
