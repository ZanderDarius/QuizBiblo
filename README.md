# QuizBiblo AI Practice Pilot

A small factual-question practice app that demonstrates AI answer judgment for natural, conversational responses.

## Run locally

1. Set an OpenAI API key for this PowerShell session:

   ```powershell
   $env:OPENAI_API_KEY = "your_api_key"
   ```

2. Start the app:

   ```powershell
   npm start
   ```

3. Open `http://localhost:3000`.

The key stays on the server and is never sent to the browser. Without a key, the app remains usable but only accepts direct approved-answer matches; all other answers are returned as **Needs review**.

## Pilot interaction

- Press **Start question**.
- Press **Space** at any time while the question is appearing to buzz in and stop it.
- Type the answer, or focus the answer box and use Windows Voice Typing with **Windows + H**.
- Press **Enter** to submit.

## Import format

Import CSV or TSV with these exact columns:

```text
question,expected_answer,accepted_answers,reference,explanation
```

Each row must be a single, factual question with an approved expected answer, optional semicolon-separated alternatives, scripture reference, and short explanation.

## Safety boundary

This is a study/practice tool. AI evaluates only the imported approved question data and should not be treated as an official competition ruling.
