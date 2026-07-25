# QuizBiblo AI Two-Player Practice Pilot

## Decision requested

Approve a small hosted web application that lets **two players on separate Windows computers** practise a live Bible-quiz interaction. The pilot proves two things at once:

1. the first player to press **Space** wins the opportunity to respond; and
2. AI can fairly judge a conversational question completion and answer rather than requiring exact wording.

This is a learning and demonstration tool, not an official competition judge or a full tournament platform.

## The experience to demonstrate

Two players open the same web link, enter the same room code, and join a two-player match. The question is displayed progressively on both screens to simulate a quizmaster reading it.

1. The server starts the question for both players at the same moment.
2. Either player can press **Space** while it is being read.
3. The server—not either browser—records the first valid buzz and locks the other player out.
4. The question stops on both screens. The successful player must first **complete the interrupted question**, then give the answer.
5. AI rules the completion and answer as Correct, Incorrect, or Needs review, explaining why.
6. If the first player’s interrupted response is not accepted, the question is reread to the other player, who receives the same opportunity to buzz, complete the question if needed, and answer.

This is the smallest useful version of the real competitive dynamic. It makes the live race visible, while preserving fairness by having one shared server decide the winner rather than trusting whichever browser reports a click first.

## The first question category

The first pilot should use **Regular / Interrogative factual questions** only: a person, place, action, recipient, or detail that is explicitly stated in the selected scripture.

Example official question:

> According to John 11:25, who said, “I am the resurrection and the life”?

If Player A buzzes after “According to John 11:25,” the player might complete the question with, “Who said, ‘I am the resurrection and the life’?” and answer, “Jesus.”

The wording need not be identical. The completion must still ask the same basic question and lead to the same approved answer. AI is useful here because it can distinguish a valid paraphrase from a completion that changes the requested fact.

The pilot will not begin with quotation, Finish-the-Verse, quotation-completion, reference, or memory questions. Those question families have distinct interruption and precision rules and would make the first demonstration harder to validate.

## What the research says about interruption

The project’s BibleQ research identifies Regular, Memory, Reference, Situation, FTV, FTVR, and Quote as question types. The **complete-the-question rule is not one of those types**; it is an *interrupted-question procedure* applied while a question is being read.

Current Bible-quiz rules state that, for an interrupted question, the player’s completion must require the same answer, contain no incorrect information, respect the introductory remarks, and ask the same basic question—even if the wording differs. They also specify that an interrupted question ruled incorrect is reread to the opposing team. [Simplified Bible Quiz Rules](https://biblequiz.com/assets/2026/25-26_TBQ-Simplified-Rules.pdf)

For this reason, the pilot will use only Regular / Interrogative factual questions. Quotation, scripture-text, and completion questions receive special interruption treatment in published rules, so they belong in a later ruleset rather than this first demo. [BibleQuiz training guidance](https://biblequiz.com/tbq/training/quizzers/)

## Question import

A coach or team imports an approved CSV or TSV question bank. Each row supplies all information the AI needs to rule the interaction transparently:

| Column | Purpose |
|---|---|
| `question` | The official full question |
| `expected_answer` | The primary approved answer |
| `accepted_answers` | Semicolon-separated approved alternatives |
| `reference` | Supporting scripture location |
| `explanation` | Short teaching explanation |
| `interruption_requirements` | The essential question components that must remain true when a player completes it |

The `interruption_requirements` field is important. It allows the AI to check whether a player changed the question while completing it, instead of only checking whether their final answer happened to be correct.

## AI ruling model

For an interrupted question, the AI receives the official question, the visible portion heard before the buzz, the approved answer data, the interruption requirements, and the player’s completion and answer.

| Decision | Meaning |
|---|---|
| **Correct** | The completion asks the same basic question and the answer communicates the approved fact. |
| **Incorrect** | The completion changes the question, introduces a conflicting fact, or the answer is clearly wrong. |
| **Needs review** | The completion or answer is incomplete, ambiguous, or uncertain. |

Example explanation:

> Correct — “Who said, ‘I am the resurrection and the life’?” keeps the same requested fact, and “Jesus” is the approved answer.

The AI operates only on the approved imported question data. It must not invent scripture facts or silently mark an unclear response wrong. A non-AI fallback can recognise exact approved answers, but must otherwise return **Needs review**.

## Hosting and shared-match design

This must be a web application, not a file opened separately on each computer. The client can be hosted through Sites, but the live-match feature also needs a server-side shared room: a player’s Space press must be sent to one authoritative service that records the first eligible buzz and broadcasts the result to both players.

Sites supports deployment of Workers-compatible web applications and can include a D1 data binding for stored records. For the pilot, the hosted application should use a shared real-time match service for the active room, with persistent storage only for question banks and match results. The exact real-time provider can be selected during implementation; the proposal requires the behavior, not a specific vendor.

```text
Player A browser ─┐                         ┌─ Player B browser
                  ├── Hosted app + match room ┤
                  │    first-buzz decision    │
                  └── AI completion/answer ──┘
```

The system records server receipt time and a sequence number for each buzz, announces the winner to both players, and ignores later buzzes for that question. This is sufficient for a fair Internet demonstration; it should not claim to reproduce physical-buzzer timing at official-event precision.

## Guardrails

- Only two players per pilot room; no accounts are required for the first demo.
- A player joins with a display name and a room code; no voice recording is stored.
- Typed answers are the default. A player may use Windows Voice Typing (`Windows + H`) in the focused answer box and review the resulting text before submission.
- Every item is human-reviewed and grounded in a cited scripture reference.
- Rulings remain practice-only and show the official answer and reference after the turn.
- Network delay is disclosed. The server’s first received buzz wins; the feature is a practice simulation, not official hardware timing.

## Success criteria

The pilot is ready to present when two people on different Windows PCs can:

1. Join the same hosted room.
2. See the same question begin at the same time.
3. Press Space; both screens agree on who buzzed first.
4. Have the winner complete an interrupted factual question and provide an answer.
5. Receive an AI explanation of the ruling.
6. See the question reread to the other player after a rejected first response.

The team should prepare at least 20 test cases covering correct paraphrases, changed-question completions, correct answers to an incorrectly completed question, incomplete answers, and clear wrong answers. Success means the app demonstrates shared live state and safe semantic judgment—not that it replaces an official human judge.

## Approval outcome

Approval authorizes a focused web pilot: **two-player rooms, server-authoritative Space-to-buzz, Regular / Interrogative factual questions, AI-judged question completion plus answer, and reread-to-opponent flow.** Quotation, memory, Finish-the-Verse, official scoring, teams larger than two, and advanced voice interaction follow only after this shared-room demonstration is accepted.
