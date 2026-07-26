# QuizBiblo Voice-First AI Practice Pilot Proposal

## Decision requested

Approve a staged pilot that turns the current two-player buzz demonstration into
a voice-first Bible quiz practice application. The finished pilot will run at:

https://quizbiblo.eveandk.chatgpt.site/

The app will act as the Quizmaster, read questions aloud with Microsoft Azure
Speech, stop speaking when a player buzzes, listen for a dictated response, rule
the completion and answer, and continue the match without requiring either
student to type an answer.

This remains a practice and teaching tool. It will not claim to replace official
quiz equipment, a Quizmaster, or human judges.

## Current development status

The deployed app is build `0.1.4`. It proves the central two-computer buzz race,
but it does not yet run a complete quiz turn.

| Capability | Current status | Evidence |
| --- | --- | --- |
| Hosted production app | Developed | The canonical production URL serves build `0.1.4`. |
| Two-player room creation and joining | Developed for a demo | Two names can join one room code. |
| Server-authoritative first buzz | Developed for a demo | The server accepts one buzz and locks the other player out. |
| Shared question start and progressive display | Partly developed | Both clients receive a start time, but the question is text-only. |
| Production-safe room durability | Not developed | Active rooms and event connections are held in one in-memory Worker instance. |
| Approved question-bank import | Not developed | Four questions are hard-coded. |
| Spoken Quizmaster using Azure Speech | Not developed | There is no speech service or audio controller. |
| Voice/dictation response capture | Not developed | There is no response workflow. |
| Interrupted-question completion and timer | Not developed | A winning buzz only locks the room. |
| AI ruling and explanation | Not developed | No grading provider or fallback exists. |
| Incorrect-answer reread to the opponent | Not developed | A host must manually start another question. |
| Needs-review and coach decision | Not developed | No review state or override exists. |
| Match history and evaluation records | Not developed | No question, transcript, or ruling records are persisted. |
| Automated coverage | Early foundation | The current test covers page versioning and the basic two-player buzz lifecycle. |

Overall, approximately **25% of the pilot foundation is developed**. The room,
hosting, and first-buzz proof are useful foundations. Most of the product work is
the spoken turn protocol, question data, grading, persistence, and production
reliability.

## Pilot scope

The first accepted pilot includes:

- two players on separate Windows computers;
- one shared room with a server-authoritative first buzz;
- Regular / Interrogative factual questions only;
- Azure Speech text-to-speech for the app's Quizmaster voice;
- Windows Voice Typing or a supported Chrome dictation path for student speech;
- no manual answer typing required;
- completion of an interrupted question before its answer;
- a combined 30-second spoken response period after identification;
- Correct, Incorrect, or Needs review rulings;
- rereading an initially incorrect interrupted question to the opponent;
- no stored raw microphone audio; and
- a visible transcript, ruling reason, official answer, and scripture reference
  when the turn is resolved.

Accounts, teams larger than two, official scoring, tournament administration,
quotation questions, memory questions, Finish-the-Verse questions, and automatic
full-duplex speech recognition are outside the first pilot.

## The spoken quiz interaction

The app must behave like a disciplined Quizmaster rather than like a general
voice assistant. Only one party is allowed to speak in each phase.

1. Both players join and the room confirms that audio is ready.
2. The host starts a question. The server selects the question and gives both
   browsers enough time to prepare the same Quizmaster audio.
3. The app announces the question and reads it aloud on both computers from a
   shared scheduled start time.
4. A player presses Space or the visible buzzer. That browser stops its own
   question audio immediately while the server determines the winning buzz.
5. The server broadcasts the winner. Both browsers cancel the active question
   audio and ignore every stale audio or timer event from that turn.
6. The app briefly identifies the winner, for example, "Interruption. Ruth."
7. Only after the identification audio has ended does the winner receive a clear
   listening cue. The winner's dictation target becomes active; the opponent's
   response controls stay locked.
8. The player completes the interrupted question and then gives the answer in
   one response. The interface teaches a dependable form such as, "The question
   is ... My answer is ..." but grading must also handle natural wording.
9. The app remains silent while the player is responding. One combined
   30-second timer covers both the completion and the answer.
10. When the response is finalized, the transcript is sent for a grounded
    ruling. The app must not start a second grading request for the same turn.
11. A Correct ruling resolves the turn. A Needs review ruling pauses the match
    for a coach decision.
12. An Incorrect ruling on an interrupted question must not reveal the official
    answer. The app announces that it will reread, locks the first player out,
    and rereads the official question for the opponent.
13. After the opponent's opportunity is resolved, the app may show and speak the
    official answer, scripture reference, and teaching explanation.

## Turn-taking and overlap prevention

The application should use one server-authoritative state machine. UI controls,
timers, dictation focus, grading requests, and audio playback must all derive
from that state.

| State | Quizmaster audio | Student speech/input | Exit condition |
| --- | --- | --- | --- |
| `waiting` | Silent | Disabled | Two players are ready and the host starts. |
| `preparing` | Silent | Disabled | Question audio is ready or a controlled fallback is selected. |
| `reading` | Question only | Buzz allowed; response disabled | Buzz accepted or post-question buzz window expires. |
| `buzz_pending` | Cancel immediately | Response disabled | Server identifies the winner. |
| `identifying` | "Interruption" and winner name only | Disabled | Identification audio fully stops. |
| `responding` | Silent | Winner only | Response is finalized or 30 seconds expires. |
| `grading` | Silent or one short waiting cue | Disabled | One ruling is returned. |
| `review` | One review announcement, then silent | Coach controls only | Coach confirms a ruling. |
| `reread_preparing` | Silent | Both players disabled | Reread audio is ready. |
| `rereading` | Official question only | Opponent may buzz; first player locked | Opponent resolves the opportunity. |
| `resolved` | Ruling/teaching feedback may play | Disabled | Host advances to the next question. |

Important coordination rules:

- Every server event and audio request carries a room, question, attempt, and
  turn identifier. Late events from an earlier turn are ignored.
- Starting any audio first cancels the previous audio source, pending fetch,
  transcript finalizer, and timer.
- A buzz performs an immediate local stop and an authoritative shared stop.
- Dictation cannot activate until the identification audio reports that it has
  ended. A short listening cue marks when the student may begin.
- Quizmaster feedback cannot speak while a student response is active.
- A reconnect restores the authoritative state; it does not restart old speech
  or grant an extra response.

This is intentionally a half-duplex interaction. It prevents the Quizmaster and
student from talking over one another and matches the rule that a quizzer waits
to be identified before responding.

## Bible quiz rules represented in the pilot

The current simplified rules provide the behavioral baseline for the first
pilot:

- A player may buzz while the question is being read and for five seconds after
  the Quizmaster finishes.
- A question is interrupted when the player buzzes before the first sound of
  the last word for the question types included in this pilot.
- After the player is identified, the player has 30 seconds to complete an
  interrupted question and give the answer.
- A valid completion requires the same answer, contains no incorrect
  information, agrees with the introductory remarks, and asks the same basic
  question with its essential parts.
- Giving the answer before correctly completing an interrupted question is
  incorrect.
- An interrupted question initially ruled incorrect is reread to the opposing
  team.

The app will expose these as practice rules and record which rule caused a
ruling. It will not implement fouls, contests, conferring, team scoring, or
special question-family rules in the first pilot.

## Azure Speech design

The existing Writing Tools Azure setup confirms that the `writingtools-speech`
resource in `eastus` can synthesize natural speech through Azure's REST API. The
same Azure resource may be reused for the pilot if its quota and billing policy
are acceptable.

The web security model is different from the desktop application:

- The Azure Speech resource key must be stored as a hosted server secret.
- The key must never be placed in browser JavaScript, HTML, D1, GitHub, an issue,
  a screenshot, a log, or a committed environment file.
- A server-side speech endpoint will validate approved QuizBiblo text, create
  SSML, request Azure audio, and return only audio or a short-lived authorized
  result to the browser.
- Requests will use an approved English neural voice, controlled speaking rate,
  pronunciation handling for scripture references and names, and a browser
  compatible audio format.
- Repeated official questions and fixed prompts should be cached when the
  selected architecture and hosting storage permit it, reducing latency and
  Azure usage.
- Synthesis failures must produce an explicit retry or controlled browser-speech
  fallback. They must never silently skip the question or expose a secret.

Before implementation, an architecture task will compare three interruption
boundary strategies: server-generated cached audio with timing metadata,
short-lived browser Speech SDK authorization with word-boundary events, and
phrase-based audio segments. The decision must be based on secret safety,
two-computer synchronization, stop latency, heard-text accuracy, Azure cost,
and compatibility with the existing Workers/Sites deployment.

## Student speech and dictation design

The first pilot does not need to build a second cloud speech service merely to
avoid typing. It will first validate these Windows paths:

1. Windows Voice Typing (`Windows + H`) dictating into the winner's focused
   transcript target.
2. A supported Chrome speech-recognition/dictation path when available and
   feature-detected.

No manual typing is required, but the recognized transcript remains visible so
the student and coach can understand what the grader received. The app does not
store raw microphone audio.

Windows Voice Typing is external to the web app. It may not provide dependable
speech-start and speech-end events to JavaScript. Therefore the pilot must not
pretend it can always perform true microphone barge-in or perfect silence
detection. A compatibility task will decide the reliable completion control:

- automatic finalization after transcript inactivity;
- a large no-keyboard "Done speaking" control; or
- a supported browser recognition event when available.

Regardless of that result, overlap is prevented by the state machine: dictation
is enabled only after the Quizmaster stops, and Quizmaster audio remains silent
until the response is final. If later testing requires automatic detection of a
student speaking over audio, direct in-app speech-to-text will be a separate
future feature.

## Question-bank contract

A coach imports an approved CSV or TSV question bank. The first schema should
include:

| Column | Purpose |
| --- | --- |
| `question_id` | Stable identifier used by audio, attempts, and history. |
| `question_type` | Must be `regular_factual` in the first pilot. |
| `question` | Official full written question. |
| `spoken_question` | Optional pronunciation-friendly wording that does not change meaning. |
| `expected_answer` | Primary approved answer. |
| `accepted_answers` | Semicolon-separated approved alternatives. |
| `reference` | Supporting scripture location. |
| `explanation` | Short teaching explanation shown only after the opportunity is resolved. |
| `introductory_remarks` | Any official remarks the completion must respect. |
| `interruption_requirements` | Essential parts that a completion must preserve. |
| `pronunciation_hints` | Optional reviewed names or SSML-safe pronunciation guidance. |

Imports must reject unsupported types, missing required fields, duplicate IDs,
unsafe markup, and rows without a reference. Every item is reviewed before it
can enter a live room.

## AI ruling contract

For an interrupted response, the server sends the grading service only the
approved question record, authoritative interruption boundary, transcript, and
rules rubric. Structured output must include:

- `decision`: Correct, Incorrect, or Needs review;
- separately evaluated `completion_result` and `answer_result`;
- a short reason tied to the approved data or a named rule;
- a confidence/review signal; and
- no invented scripture facts.

The grader must verify completion before answer. A correct answer cannot rescue
a completion that changes the question. An exact deterministic matcher may
accept approved answers when no semantic judgment is needed; uncertain or
malformed results become Needs review, never an unsupported automatic failure.

The official answer and any explanation that reveals it remain protected until
the opponent's reread opportunity is finished.

## Persistence, privacy, and reliability

- Active match state must move beyond the current process-local in-memory maps
  so room ownership, buzz locks, timers, and reconnects survive Worker routing
  and restarts.
- The first-buzz write must be atomic: only one eligible player can win an
  attempt.
- D1 may store approved questions, room snapshots, attempts, transcripts,
  rulings, and review decisions. The real-time delivery design must be selected
  for the hosting environment rather than assumed.
- Raw microphone audio is not uploaded or stored in the baseline pilot.
- Transcript retention must be disclosed and limited. Test rooms need a clear
  deletion path.
- Azure, grading-provider, and hosting secrets remain server-side and are
  redacted from errors and logs.
- Requests need size limits, rate limits, turn IDs, and idempotency protection
  so duplicate clicks, reconnects, and delayed responses cannot advance a turn
  twice.

## GitHub execution and daily status

The implementation is divided into separate GitHub issues in dependency order.
The [voice-first pilot roadmap](https://github.com/ZanderDarius/QuizBiblo/issues/17)
is the daily status dashboard. An issue remains open until its feature is
implemented, tested, deployed to the canonical production site, and demonstrated
there.

Every implementation issue must end with a delivery comment containing:

- the production build/version and commit;
- automated test results and the named manual scenario used;
- the production URL;
- what visibly or behaviorally improved compared with the previous build;
- a screenshot or short recording for visible work, or a concise event trace for
  server-only behavior;
- any limitation or follow-up discovered; and
- confirmation that the live production result was refreshed and verified.

Only then is the issue checked off in the roadmap and closed. This gives the
team a reliable daily record instead of treating merged code as delivered work.

## Planned issue sequence

The GitHub roadmap tracks these deliverables:

1. [Freeze the voice-first pilot behavior, rules matrix, and state-machine contract](https://github.com/ZanderDarius/QuizBiblo/issues/1).
2. [Replace ephemeral active rooms with production-safe shared match state](https://github.com/ZanderDarius/QuizBiblo/issues/2).
3. [Define, import, validate, and store Regular / Interrogative question banks](https://github.com/ZanderDarius/QuizBiblo/issues/3).
4. [Validate Windows Voice Typing and Chrome dictation as a no-typing response path](https://github.com/ZanderDarius/QuizBiblo/issues/4).
5. [Select the Azure playback, caching, synchronization, and interruption-boundary architecture](https://github.com/ZanderDarius/QuizBiblo/issues/5).
6. [Add a secret-safe server-side Azure Speech service](https://github.com/ZanderDarius/QuizBiblo/issues/6).
7. [Add coordinated Quizmaster audio preparation, playback, and cancellation](https://github.com/ZanderDarius/QuizBiblo/issues/7).
8. [Implement the authoritative spoken-turn state machine, identification, buzz window, and 30-second response timer](https://github.com/ZanderDarius/QuizBiblo/issues/8).
9. [Add winner-only dictated response capture and reliable finalization](https://github.com/ZanderDarius/QuizBiblo/issues/9).
10. [Implement grounded AI completion-and-answer grading with a safe fallback](https://github.com/ZanderDarius/QuizBiblo/issues/10).
11. [Implement Correct, Incorrect, Needs review, coach override, and protected reread-to-opponent behavior](https://github.com/ZanderDarius/QuizBiblo/issues/11).
12. [Persist match attempts, transcripts, rulings, review history, and retention controls without storing audio](https://github.com/ZanderDarius/QuizBiblo/issues/12).
13. [Add voice-first accessibility, setup guidance, recovery, and observability](https://github.com/ZanderDarius/QuizBiblo/issues/13).
14. [Expand automated race, state-machine, audio, grading, privacy, and security tests](https://github.com/ZanderDarius/QuizBiblo/issues/14).
15. [Build the 20-plus-case grading evaluation set and run the two-Windows-PC pilot](https://github.com/ZanderDarius/QuizBiblo/issues/15).
16. [Complete the end-to-end production acceptance release at the canonical URL](https://github.com/ZanderDarius/QuizBiblo/issues/16).

## Pilot acceptance criteria

The pilot is ready for a decision when two students on separate Windows PCs can:

1. Join the same room and confirm that audio/dictation readiness is understood.
2. Hear the same approved question begin at a coordinated time.
3. Buzz during speech and have both computers stop the Quizmaster promptly.
4. See and hear the same winner identification.
5. Dictate a completion and answer without manually typing.
6. Receive one transparent Correct, Incorrect, or Needs review ruling.
7. Have an initially incorrect interrupted question reread to the opponent
   without revealing the answer first.
8. Reconnect without duplicating audio, timers, grading, or opportunities.
9. Complete at least 20 reviewed cases covering correct paraphrases, changed
   questions, answer-before-completion, incomplete answers, clear wrong answers,
   timeouts, and review cases.
10. Demonstrate that no Azure key, grading key, or raw microphone audio appears
    in the browser, repository, issue history, logs, or stored match record.

Success means the hosted app demonstrates a credible, safe spoken practice turn.
It does not mean the app is approved as an official competition judge.

## References

- [Simplified Bible Quiz Rules, 2025-2026](https://biblequiz.com/assets/2026/25-26_TBQ-Simplified-Rules.pdf)
- [BibleQuiz training: interrupting, completing, and answering](https://biblequiz.com/tbq/training/quizzers/)
- [Azure Speech text-to-speech REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Azure Speech synthesis and word-boundary events](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis)
- Local setup reference: `WritingTools/docs/Azure Speech Read-Aloud Setup.md`
