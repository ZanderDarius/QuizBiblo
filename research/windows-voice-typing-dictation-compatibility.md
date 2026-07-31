# Issue 4 — Windows Voice Typing and Chrome Dictation Compatibility Report

**Date:** July 31, 2026  
**Status:** In progress (research + baseline decision complete)

## Summary (baby version)

Issue 4 is not a "build feature" yet.  
It is a **decision-and-testing ticket** that tells us which no-typing method is most reliable before we write the response UI.

- We want people to answer with voice, not keyboard typing.
- We need to decide **how to know when speech is finished**.
- We must keep it safe: no raw mic audio should be sent to QuizBiblo.

## Test matrix to run

| Test area | Environment | Expected behavior to verify |
|---|---|---|
| Browser baseline | Chrome (Windows 11) current stable | Can focus answer target and receive dictated text in editable field |
| Voice Typing | Windows 11 + `Win + H` | Dictation inserts text only in focused target after host winner state |
| Chrome dictation path | Chrome speech-capability branch | `speechstart` / `speechend` / `result` events observed (if feature available) |
| Permission denied | Browser mic denied | Show clear “Please enable mic/voice access” with safe fallback |
| No microphone | No input device present | Graceful fallback to manual typing or coach handoff |
| Dictation stop | Dictation ends naturally | Auto-finalize rule should still be testable |
| Browser refresh/reconnect | Refresh mid-response | Room/state restoration keeps turn integrity and does not double-send responses |
| Stress text | Short, long, punctuation, names, pauses, correction phrases | Transcript remains readable and reviewable |
| Interruptions | Stops/starts and background noise | No crashes, stale text, or duplicate submit events |

## Current evidence status (this repo stage)

At this stage, Issue 4 is a **research artifact**, not yet a production experiment in code.  
The environment used for this work did not include a local two-PC Windows 11 + Windows Voice Typing lab run, so the matrix is prepared but not fully executed here.

## Baseline path selected

- **Primary path:** Windows Voice Typing (`Win + H`) into a programmatically focused transcript target.
- **Secondary path:** Browser-level dictation when feature-detected and explicitly available.
- **Fallback path:** Visible “Done speaking” control + short inactivity timer (for both event gaps and manual completion).

This is a **no-typing-first capture** path because the text box updates from a speech pipeline, but it is not “true in-band mic control” (no always-on barge-in guarantee in every browser/state).

## Response finalization rule

- Use browser recognition events when present (`speechend` or equivalent finalization event).
- If events are unavailable or unreliable, finalize on:
  1. explicit **Done speaking** button, or
  2. controlled inactivity window (e.g. 1.8–2.4 seconds of no transcript change after user cue),
  whichever is safer for current session.

## No-typing vs true automatic barge-in

- **No-typing required:** winner has the speech target focused and dictated text is shown before grading.
- **Not full true barge-in:** unless we later run a dedicated embedded STT service path, we should not claim one complete “talk anytime” auto-stop system from OS voice input alone.

## Privacy note

- QuizBiblo should not upload or store raw microphone audio in this baseline.
- Transcript text is for gameplay/transcript review only and should be trimmed or retired per retention policy before/at room end.

## Setup checklist for users before first question

1. Use Windows 11 and open Chrome.
2. Ensure microphone permissions for the site are enabled.
3. Start with one microphone test sentence in a normal input field.
4. Confirm they can use `Win + H` with the app focused answer control.
5. Confirm fallback controls are visible (`Done speaking`).

## Recommendation to close Issue 4

Close this research issue with:

- Baseline selected: **Windows Voice Typing as primary, Chrome dictation when available**.
- Fallback selected: **Done speaking + inactivity timeout**.
- Requirement confirmed: **No raw audio upload/storage in baseline**.
- Follow-up required: run the actual two-computer trial and attach the recording as proof for implementation issue #9/10.
