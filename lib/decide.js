import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL } from "./answers.js";

// Above this, the text is treated as not being a real yes/no question.
const UNFOCUSED_THRESHOLD = 0.6;
// Above this hedge score (see decide), the ball declines to commit.
const HEDGE_THRESHOLD = 0.75;

// Seven independent noul judgments over the same question. They run in
// parallel in a single Jev request and cannot see one another; code below
// combines them into one of the 20 answers.
const QUESTIONS = {
  // Direction of the answer
  favorable: noul(
    "Does the most sensible answer to this question lean towards yes, or towards a favorable outcome for the asker?"
  ),
  // Strength of the answer
  certain: noul(
    "Is the answer to this question clear-cut and close to certain, rather than merely plausible?"
  ),
  // One signal per non-committal answer
  hazy: noul(
    "Is this question vague or ambiguous, so that it is too unclear to answer well?"
  ),
  later: noul(
    "Is the answer to this question something that has not been settled yet, and would be easier to know at a later time?"
  ),
  unwelcome: noul(
    "Would a truthful answer to this question probably be unwelcome or upsetting to the asker?"
  ),
  unpredictable: noul(
    "Does the answer to this question depend on chance or unknowable factors, making it impossible to predict?"
  ),
  unfocused: noul(
    "Is this text not a genuine yes/no question, for example an open-ended question, a statement, a command, or empty of meaning?"
  ),
};

/**
 * Combine the raw noul probabilities into one of the 20 answers.
 * Pure function, so the policy can be tuned and tested without the API.
 */
export function decide(p) {
  // Not a real yes/no question: nothing to answer, whatever the other signals say.
  if (p.unfocused >= UNFOCUSED_THRESHOLD) {
    return { category: "non-committal", answer: NON_COMMITTAL.unfocused };
  }

  // How lopsided the yes/no lean is, from 0 (coin flip) to 1 (one-sided).
  const lean = Math.abs(p.favorable - 0.5) * 2;

  // The strongest hedging signal, discounted by how clear the lean is: a
  // confident yes/no commits even when the question is about the future, while
  // a near coin-flip with a strong hedging signal declines to commit.
  const [signal, level] = Object.keys(NON_COMMITTAL)
    .filter((name) => name !== "unfocused")
    .map((name) => [name, p[name]])
    .reduce((best, entry) => (entry[1] > best[1] ? entry : best));

  if (level * (1 - lean) >= HEDGE_THRESHOLD) {
    return { category: "non-committal", answer: NON_COMMITTAL[signal] };
  }

  // Strength blends the lean with how certain the answer is.
  const strength = (lean + p.certain) / 2;

  const list = p.favorable >= 0.5 ? AFFIRMATIVE : NEGATIVE;
  const index = Math.min(list.length - 1, Math.floor((1 - strength) * list.length));
  return {
    category: p.favorable >= 0.5 ? "affirmative" : "negative",
    answer: list[index],
  };
}

let client;

export async function askJev(question) {
  client ??= new TypeSafeClient();
  const { answers } = await client.systemOne({
    state: { question },
    questions: QUESTIONS,
  });

  const signals = Object.fromEntries(
    Object.entries(answers).map(([name, a]) => [name, a.noul])
  );
  return { ...decide(signals), signals };
}
