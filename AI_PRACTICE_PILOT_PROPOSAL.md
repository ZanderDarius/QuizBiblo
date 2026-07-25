# QuizBiblo AI Practice Pilot

## Decision requested

Approve a small first release that proves QuizBiblo’s defining value: a quizzer can answer naturally, in their own words, and the system can determine whether the **meaning** is correct. This pilot is a learning tool, not an official competition judge.

The pilot deliberately avoids building a complete quiz platform. It focuses on one question category, one import format, one quiz interaction, and one visible use of AI.

## The problem we are solving

Traditional quiz software compares a response to a stored answer. That works when the expected response is a single word, but it fails in normal conversation. A learner may say, “It was Jesus speaking to Martha,” while the expected answer is stored as “Jesus said it to Martha.” The words are not identical, but the answer is correct.

QuizBiblo should not act like a simple answer-key checker. Its first promise is to accept a reasonable conversational answer, explain why it is correct or incomplete, and safely identify answers that need a person’s review.

## Recommended first scope: short factual questions

The first question type will be **short factual questions**: questions with one clear, scripture-supported fact such as a person, place, action, or recipient.

Examples:

| Question | Approved answer | Valid conversational response |
|---|---|---|
| Who said, “I am the resurrection and the life”? | Jesus | “It was Jesus.” |
| To whom did Jesus say this? | Martha | “He was speaking to Martha.” |
| What city was Jesus born in? | Bethlehem | “Jesus was born in Bethlehem.” |

This category is the right first choice because it makes the AI value easy to demonstrate and easy to test. It does **not** require the stricter rules needed for verse recitation, quotations, references, timing rules, or multi-part specialty questions.

The first pilot will not include memory verses, Finish the Verse, quotation grading, live multiplayer, physical buzzers, spoken quizmaster audio, accounts, or analytics. Those are valuable later, but they would delay the proof that AI can judge meaning fairly.

## User experience

The experience will simulate the live quiz dynamic with simple keyboard controls and visible text.

1. A coach or learner imports an approved list of questions and answers.
2. The question appears on screen as though a quizmaster is reading it.
3. The learner presses **Space** at any point to buzz in. The question immediately stops, so the learner does not see the unfinished question.
4. An answer box receives focus. The learner types an answer and presses **Enter** to submit it.
5. If the learner prefers to speak, they can use Windows Voice Typing in the focused answer box with **Windows + H**, then check the text before submitting.
6. QuizBiblo returns **Correct**, **Incorrect**, or **Needs review**, followed by a short explanation, the expected answer, and the scripture reference.

This interaction demonstrates interruption and conversational response without making speech recognition, text-to-speech, or microphone recording part of the first build.

## Question import

Question banks should be imported rather than typed into the application one at a time. Coaches and quiz teams often already maintain their questions in spreadsheets, and importing lets the team begin with its own reviewed material.

The initial importer accepts CSV or TSV files with these columns:

| Column | Purpose |
|---|---|
| `question` | The exact prompt shown to the learner |
| `expected_answer` | The primary approved answer |
| `accepted_answers` | Optional alternatives, separated by semicolons |
| `reference` | The supporting scripture location |
| `explanation` | A short teaching explanation shown after the ruling |

Only clear, factual, source-supported questions should be imported for the pilot. Each item must have one intended answer and any approved aliases prepared by the content owner. Imported questions remain the responsibility of the organisation that owns or is licensed to use them.

## How the AI judge works

The AI receives only the approved material for the current question:

- the question;
- expected answer and approved alternatives;
- scripture reference and explanation; and
- the learner’s submitted text.

It returns one of three decisions:

| Decision | Meaning |
|---|---|
| **Correct** | The learner communicated the required fact, including an acceptable paraphrase. |
| **Incorrect** | The learner clearly gave a conflicting fact. |
| **Needs review** | The response is incomplete, ambiguous, or not sufficiently certain to rule automatically. |

The result must be explainable. For example: “Correct — ‘Jesus was speaking to Martha’ communicates the approved answer, ‘Jesus said it to Martha.’” Or: “Needs review — your answer identifies Jesus but does not identify Martha, which this question requires.”

The AI must not invent facts, search for an answer outside the approved question data, or silently turn an unclear answer into a wrong answer. When AI is unavailable, the app may accept a direct approved match but must otherwise return **Needs review** rather than claim it made a semantic ruling.

## Guardrails

- This is a practice tool; it is not an official competition ruling system.
- A human content owner approves every question, expected answer, and accepted alternative.
- AI operates only on the approved current question data.
- Uncertain answers become **Needs review**, never an automatic incorrect ruling.
- The learner sees the expected answer, reference, and explanation after each response.
- The first pilot does not store raw voice recordings. Windows Voice Typing supplies text that the learner can review before submission.

## Success criteria

The pilot is ready for a team demonstration when a user can:

1. Import a small factual question bank.
2. Start a question and press Space to interrupt it.
3. Type or dictate a natural-language answer.
4. Receive a clear ruling and explanation.
5. See the approved answer and scripture reference.

Before broad release, the team should test at least 20 planned answer variations, including correct paraphrases, accepted aliases, incomplete answers, ambiguous answers, and clearly incorrect answers. The target is not to eliminate human judgment; it is to show that QuizBiblo handles natural language better than exact text matching while keeping unclear cases safe.

## Approval outcome

Approval authorizes a focused pilot: **imported short factual questions, Space-to-buzz interaction, typed or dictated responses, and transparent AI answer judgment**. After the pilot demonstrates reliable value, the next decision can be whether to add Situation questions, Reference questions, longer memory work, or voice-led quizmaster features.
