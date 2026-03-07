# QuizBiblo Voice UI Prototype

This is Phase 1 of the AI Quizzer Coach build, focused only on the voice-first UI.

## What is implemented

- Voice session start/stop UI
- Listening/speaking/idle visual state
- Live conversation log (user + assistant)
- Browser speech recognition (STT)
- Browser speech synthesis (TTS)
- Basic quiz commands:
  - `start quiz`
  - `jump`
  - `repeat question`
  - `what's my score`

## Run

1. Open the `QuizBiblo` folder in VS Code.
2. Open `index.html` in a browser (Edge or Chrome recommended).
3. Allow microphone permission when prompted.
4. Click `Start Session` and speak commands.

## Scope note

This prototype intentionally excludes backend, rule-complete WBQA enforcement, and full question bank logic.
