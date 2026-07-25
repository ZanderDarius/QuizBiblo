# QuizBiblo — Self-Guided Bible Quizmaster App Report

## Purpose

Build a web-first app that lets an individual Bible quizzer practise without a live quizmaster. The app should ask questions aloud or on screen, enforce a chosen timing/ruleset, accept typed or spoken answers, give a transparent ruling, show the supporting scripture, and schedule useful follow-up practice.

This is a **practice and study tool**, not an official competition judge. Official leagues, churches, and tournaments should be able to configure their own rules and decide whether a result is official.

## Reference research: what BibleQ shows us

[BibleQ](https://bibleq.com/) is a useful reference library, especially for World Bible Quiz Association-style material using the Berean Standard Bible (BSB). It provides scripture portions, question banks, a quiz generator, audio, concordances, and unique-word lists.

The product lessons worth carrying forward are:

- Questions are organised by a clear **type**, not merely mixed into one bank: BibleQ lists Regular, Memory, Reference, and Situation questions; its generator documentation also refers to FTV, FTVR, and Quote specialties. [Question banks](https://bibleq.com/questions.htm), [generator documentation](https://bibleq.com/software.htm)
- Questions should retain their scripture location. BibleQ's generator data is tab-delimited with `verse`, `type`, `question`, and `answer` fields, and expects verse-sorted data. [Generator documentation](https://bibleq.com/software.htm)
- Random does not mean unbalanced. BibleQ can divide a portion into verse/chapter sectors so quizzes cover the material, avoid two questions from one verse, and keep adjacent questions from clustering in one place. [Generator documentation](https://bibleq.com/software.htm)
- Practice should include more than Q&A: BibleQ offers chapter audio, concordances, scripture portions, and unique-word lists. [Audio](https://bibleq.com/audio.htm), [study tools](https://bibleq.com/tools.htm)

Do **not** copy BibleQ's design, question wording, audio, database, or branding into a public app unless the relevant copyright/licence terms explicitly allow it. Use it as a functional reference, retain attribution for permitted source material, and obtain written rights before shipping bundled third-party questions or recordings.

## Who the app serves

| User | Need | Main experience |
|---|---|---|
| Solo quizzer | Practise whenever they want | A guided round with immediate, fair feedback |
| New quizzer | Learn the material and formats | Hints, shorter drills, explanations, no harsh timer by default |
| Competitive quizzer | Rehearse conditions similar to a meet | Timed, balanced, configurable ruleset and performance analytics |
| Coach/content editor | Prepare a safe, accurate question bank | Review workflow, import/export, duplicate and reference checks |
| Organisation admin | Use its own material and rules | Private collections, role controls, configurable templates |

## Core user journeys

1. **Quick practice:** choose a passage, a question type, difficulty, and 5/10/20-question session; answer; see results and next drills.
2. **AI quizmaster round:** choose a ruleset; the app announces the question and timer; user answers by voice or typing; the app displays its ruling, matched answer, verse, and rationale.
3. **Weakness recovery:** after a session, the app creates a short review set from missed verses, weak chapters, and confused terms.
4. **Memory drill:** user completes a verse, identifies a reference, or speaks a quotation; the app checks the text with reasonable tolerance.
5. **Coach authoring:** editor imports a properly licensed bank, reviews every item, assigns types and answer rules, then publishes it to a private collection.

## Question types to support

Every question must declare its type, source translation, exact scripture reference(s), expected answer, grading policy, author/reviewer, and revision history.

| Type | What it tests | Example interaction | How to grade |
|---|---|---|---|
| Regular / factual | A person, action, place, sequence, or detail stated in the text | “Who said …?” | Exact fact plus approved aliases |
| Interrogative | A regular question beginning with who/what/when/where/why/how | “Where did …?” | Same as factual; label separately only if the ruleset needs it |
| Memory | Recall of a passage or phrase | Type/speak the next phrase | Word/phrase matching with a configurable tolerance |
| Reference | Give the book/chapter/verse for supplied text or fact | “In which verse does … occur?” | Exact or ruleset-defined reference precision |
| Situation | Identify the setting, speaker, audience, or event from clues | “After what event did …?” | Approved fact pattern and required details |
| Finish the Verse (FTV) | Continue a specified verse from a prompt | Prompt then continuation | Compare the required continuation; show skipped/changed words |
| FTV with Reference (FTVR) | Finish the verse and give its reference | Spoken/typed verse plus location | Grade text and reference separately, then combine by rule |
| Quote | Supply a specified quotation | “Quote the words of …” | Strictness is configurable; cite exact source |
| Unique-word / concordance | Find or identify an uncommon word and its occurrence | “Which verse contains …?” | Exact word/reference with normalisation of punctuation/case |
| Multiple choice | Beginner-friendly recognition practice | Four options, optionally with a timer | One correct option; distractors must be plausible and non-misleading |
| Ordering / matching | Sequence people, events, or references | Drag or select order | Validate the complete ordered set |
| Audio comprehension | Learn through listening | Hear a verse, then answer | Same grading as the underlying type; include transcript option |

### Recommended practice modes

- **Learn mode:** untimed, hints allowed, explanation immediately after each question.
- **Drill mode:** one type or one chapter; adaptive repeats on misses.
- **Quizmaster mode:** spoken prompts, a visible timer, no answer until the ruling.
- **Mock meet mode:** a balanced, fixed-length packet with a selected ruleset.
- **Review mode:** spaced repetition for missed questions and adjacent verses.
- **Accessibility mode:** keyboard-only controls, captions/transcript, adjustable pace, no voice requirement.

## What is okay — content and judging standards

### Good question content

- Ground every answer in one or more explicit verses from the selected translation.
- Ask one clear thing at a time; use a single, unambiguous expected answer.
- Keep question language neutral and sufficiently specific: include the requested speaker, audience, event, or time when it disambiguates the answer.
- Record accepted aliases, spelling variants, names/titles, and allowable partial answers before the question goes live.
- Use balanced coverage: spread questions across the selected portion, prevent duplicate verses in one round, and avoid several consecutive questions from the same scene.
- Label each item with difficulty and cognitive task (recall, reference, quotation, sequence) so a session can be deliberately balanced.
- Let users report an ambiguous or incorrect item; immediately suppress reported items from scored practice until reviewed.
- Display the verse and a concise explanation after a ruling so practice remains educational.

### Fair answer handling

- Ignore letter case, punctuation, extra spaces, and common speech-to-text errors where they do not change meaning.
- Accept pre-approved aliases (for example, a person's recognised alternate name), but never silently broaden answers beyond the source text.
- For longer recitation, distinguish **minor delivery variation** from a changed, missing, or added meaningful word. Show the comparison, never only a black-box score.
- When an answer is partially correct, say exactly what was correct and what is missing; ruleset settings determine whether that earns credit.
- Mark uncertain automatic rulings as **Needs review**, not wrong. Let the user self-score or submit it to a coach.

## What is not okay

- Do not present AI speech recognition or fuzzy matching as an infallible official ruling.
- Do not use a question that has more than one reasonable answer without accepting all reasonable source-supported answers or rewriting it.
- Do not mix Bible translations within a scored session without prominently declaring that behaviour and mapping expected wording per translation.
- Do not generate unreviewed AI questions directly into competitive/scored banks. AI can draft; a qualified editor must verify every reference, prompt, answer, and ambiguity.
- Do not penalise an accent, disability, microphone issue, or transcription mistake. Typed-answer and replay alternatives are required.
- Do not make a user guess hidden rules. Show timer, question type, required precision, scoring rule, and whether hints reduce score before each session.
- Do not expose a child’s account, voice clip, real name, or progress publicly by default. Do not collect voice recordings unless there is a clear purpose, consent, retention limit, and deletion path.
- Do not bundle or republish third-party scripture text, questions, audio, or PDFs merely because they can be downloaded. Verify the licence and attribution requirements separately.
- Do not make doctrinal claims outside the selected source text in answer explanations. If a collection reflects a denomination or league’s rules, label it.

## Product requirements

### Must-have MVP

- Account-optional local practice; account only when cross-device history is wanted.
- Choose collection/translation, scripture portion, chapter range, question types, difficulty, session length, and timer setting.
- Guided question screen with prompt, type indicator, timer, skip, repeat, hint, answer input, and reveal/ruling.
- Typed-answer grading with a transparent exact/alias/normalised comparison.
- Question bank with references, accepted answers, explanations, and status (`draft`, `reviewed`, `published`, `flagged`, `retired`).
- Balanced question selector that prevents repeated questions and duplicate verse locations in the same session unless explicitly allowed.
- Result page: score, accuracy by type/chapter, missed questions, time per answer, and a “practise these next” button.
- Content-report action and a review queue.
- Import/export for a documented CSV/TSV format; export practice results as CSV.
- Basic privacy controls and data deletion.

### High-value version 2

- Voice quizmaster: text-to-speech prompt, speech-to-text answer, transcript confirmation, and replay.
- Ruleset templates for different organisations; each template controls timing, specialties, answer precision, scoring, and review behaviour.
- Spaced repetition and goal plans.
- Scripture reader with audio, word highlighting, bookmarks, and deep links from every question.
- Concordance and unique-word drills.
- Coach dashboard, private groups, assignments, and progress visibility with learner consent.
- Printable PDF/CSV question packets and an on-screen host mode.
- Offline-friendly mobile experience for pre-downloaded, licensed collections.

### Later / optional

- Live multiplayer rooms and buzzer simulation.
- Video/remote coach review.
- Community question submissions, only with moderation and provenance requirements.
- AI coaching conversation that explains strategy without inventing scripture facts.

## Quizmaster-mode behaviour

The flow should feel calm, predictable, and human:

1. Announce question number, type/specialty, and required answer form.
2. Read the question; allow replay if the chosen ruleset permits it.
3. Show the timer and listen/accept typed input.
4. Present the transcript for confirmation when voice recognition confidence is low.
5. Rule `Correct`, `Incorrect`, `Partial`, or `Needs review` with a brief, visible reason.
6. Reveal expected answer, acceptable alternatives, scripture reference, and verse text according to the selected study/competition mode.
7. Log performance and choose the next question without clustering material.

The app should have a clear **practice toggle**: beginners may use hints, replay, scripture reveal, and slower timing, while mock-meet users can lock those options per a ruleset.

## Answer-grading design

Use a rule-based grader first; it is easier to audit than a pure AI judgment.

1. Normalise input: lower-case, trim, remove harmless punctuation, standardise common number/ordinal forms.
2. Match exact approved answers and aliases.
3. For memory/quote items, align answer tokens with the expected text and identify meaningful omissions or substitutions.
4. Evaluate required components: for example, FTVR has `verse-text` and `reference` components.
5. Return a decision plus evidence: matched alias, missing required component, or textual differences.
6. If confidence is below a configured threshold, return `Needs review`; never silently call it wrong.

AI may help suggest aliases, explain a result, or flag potential ambiguity. It must operate on the approved question/verse data, cite the source verse, and route unclear cases to human review.

## Question-bank data model

### `scripture_verses`

- `id`, `collection_id`, `translation`, `book`, `chapter`, `verse_start`, `verse_end`
- `display_reference`, `text`, `normalised_text`, `licence_attribution`, `source_url`

### `questions`

- `id`, `collection_id`, `status`, `type`, `difficulty`, `prompt`, `prompt_audio_url`
- `reference_start_id`, `reference_end_id`, `expected_answer`, `explanation`
- `answer_components_json`, `accepted_answers_json`, `grading_policy`
- `tags`, `author_id`, `reviewer_id`, `reviewed_at`, `revision`

### `quiz_templates`

- `id`, `ruleset_id`, `name`, `question_count`, `time_limit_seconds`
- `type_mix_json`, `specialty_positions_json`, `chapter_weights_json`
- `repeat_policy`, `hint_policy`, `replay_policy`, `reveal_policy`

### `practice_attempts`

- `user_id`, `question_id`, `session_id`, `answer_mode`, `transcript_or_answer`
- `ruling`, `confidence`, `elapsed_ms`, `hint_used`, `review_override`, `created_at`

Never store raw voice audio by default. If optional recording is enabled, it needs explicit consent, encryption, a retention period, and deletion controls.

## Quiz-generation rules

- Select only `published` questions from the chosen collection and translation.
- Apply the template’s question-type mix and specialty positions.
- Sector the selected material by chapter or verse range; pick across sectors before filling from any one sector.
- Do not use the same question twice in a session.
- Do not use two questions with the same primary verse in a session by default.
- Avoid adjacent questions from the same chapter/scene/type where enough alternatives exist.
- Respect a user’s recent-history window so old questions are favoured over repeats.
- Log the generation seed, source question IDs, template version, and exclusions so a round can be reproduced and audited.
- If the bank cannot meet a requested template, say so and show the shortage rather than quietly breaking the rules.

## Content operations and quality assurance

### Import pipeline

1. Import only content with a recorded source and permission status.
2. Parse CSV/TSV/XLSX into a staging area; BibleQ’s generator documentation indicates the useful baseline fields are verse, type, question, and answer. [Source](https://bibleq.com/software.htm)
3. Validate reference syntax, translation, missing answers, duplicate prompts, duplicate answer/reference pairs, and unsupported question types.
4. Assign a reviewer; validate the prompt and all accepted answers against the cited verse.
5. Publish only after review; preserve revisions and an audit log.

### Required tests before release

- Each published question links to a valid passage and has at least one reviewed correct answer.
- Each graded alias produces the intended ruling; near-miss answers do not receive a false positive.
- Generated packets meet template type mix and coverage rules.
- Screen-reader, keyboard-only, caption/transcript, and no-microphone paths complete a whole session.
- Timer, pause, reconnect, and interrupted speech scenarios are predictable and logged.
- Privacy/deletion and permission tests pass before collecting user data.

## Safety, privacy, and legal checklist

- Publish a plain-language privacy notice and age-appropriate consent flow before collecting personal information.
- Treat voice transcripts and audio as sensitive user content; minimise collection and provide deletion/export.
- Use HTTPS, secure authentication, least-privilege roles, encrypted backups, rate limits, and audit logs for editor/admin actions.
- Record the translation, source, licence, attribution, and redistribution terms for every scripture/audio/question collection.
- Separate `source material`, `user-created material`, and `AI-generated draft material` in the database and UI.
- Display a non-official-results notice unless a partner organisation explicitly certifies a ruleset.
- Provide reporting, moderation, and takedown paths for content concerns.

## Suggested technical approach

Start with a responsive web app / PWA so users can practise from phone or laptop. Keep the core engine independent of the interface:

```text
Licensed content + editor review
              ↓
Question bank + scripture/reference index
              ↓
Ruleset/template + balanced selector
              ↓
Quizmaster session engine
     ↙             ↓              ↘
typed grading   voice layer      analytics/review plan
```

Use a relational database for references, questions, attempts, revisions, and rulesets. Store structured answer components as JSON only where a relational shape would be overly rigid. Build the typed grading path first; add browser speech APIs or a speech provider behind the same `AnswerInput` interface later.

## MVP delivery plan

| Phase | Outcome | Exit criteria |
|---|---|---|
| 1. Foundations | One licensed/private collection and reviewed question schema | Can browse verses and author/review questions |
| 2. Solo practice | Typed quick practice with balanced selection | A user completes a 10-question session and gets transparent feedback |
| 3. Progress | History and targeted review | Missed material reliably appears in a review drill |
| 4. Quizmaster | Timers, ruleset templates, and simulated live round | Reproducible mock round works without a human host |
| 5. Voice/accessibility | Optional speech with robust fallback | Voice failure never prevents a session or creates an unfair penalty |
| 6. Organisation tools | Private groups, coach review, import/export | Content access and reporting obey roles and consent |

## Success measures

- Practice completion rate and returning weekly quizzers.
- Percentage of attempts receiving a clear automatic ruling versus `Needs review`.
- False-positive and false-negative grading reports per 1,000 attempts.
- Improvement in repeat accuracy for previously missed verses.
- Coverage: share of the chosen portion represented in a session plan.
- Content quality: flagged-question rate and median review turnaround.
- Accessibility: successful completion without microphone, mouse, or audio.

## Decisions to make before coding

1. Which first audience and ruleset: casual learners, a particular league, or a private church/youth group?
2. Which Bible translation(s) and what written licence permits storage, display, audio, and redistribution?
3. Will version one include only original/private questions, or a separately licensed imported question bank?
4. What answer precision is expected for each question type, especially memory/quote work?
5. Are user accounts needed in the MVP, or should anonymous local practice ship first?
6. What age groups will use it, and what parental-consent/privacy requirements follow?

## Recommended first build

Build a small, trustworthy version before adding an “AI judge”:

- One clearly licensed passage collection.
- 100–200 human-reviewed questions across Regular, Memory, Reference, Situation, and FTV types.
- Typed answer input, transparent grader, timer, balanced 10-question practice round, and result/review screen.
- Simple content-review screen and CSV/TSV importer.
- Speech as an opt-in enhancement after typed grading proves reliable.

That combination delivers the central promise — a dependable practice quizmaster — while keeping the first release fair, legally safer, and manageable.
