// The 20 canonical Magic 8 Ball answers
// https://en.wikipedia.org/wiki/Magic_8_Ball#Possible_answers
//
// Affirmative and negative lists are ordered from most to least emphatic so a
// strength score can index straight into them.

export const AFFIRMATIVE = [
  "It is certain",
  "Without a doubt",
  "Yes definitely",
  "It is decidedly so",
  "You may rely on it",
  "As I see it, yes",
  "Most likely",
  "Outlook good",
  "Yes",
  "Signs point to yes",
];

export const NEGATIVE = [
  "My reply is no",
  "My sources say no",
  "Don't count on it",
  "Outlook not so good",
  "Very doubtful",
];

// Each non-committal answer is paired with the signal that selects it.
export const NON_COMMITTAL = {
  hazy: "Reply hazy, try again",
  later: "Ask again later",
  unwelcome: "Better not tell you now",
  unpredictable: "Cannot predict now",
  unfocused: "Concentrate and ask again",
};
