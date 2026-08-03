# QuizBiblo

A local web demo for testing first-buzz behavior between two browsers.

## Run it

```powershell
npm.cmd start
```

Open `http://localhost:3101` on two computers that can reach the same server. For a quick local test, use two browser windows on the same computer.

## Test the buzz

1. Player one enters a name and selects **Create room**.
2. Share the displayed room code with player two.
3. Player two enters a name, the same room code, and selects **Join room**.
4. The host selects **Start question**.
5. Both players press **Space** while the question is reading.

The server accepts the first buzz it receives, locks the other player out, and shows the same winner on both screens. The current version focuses on shared-room play and first-buzz handling; scoring and answer judging come next.

## Local developer keys

The hosted app must receive Azure and OpenAI credentials through Sites secrets. For local development only, start the Node server and open:

```text
http://localhost:3101/__dev/settings
```

This page is blocked for non-loopback requests. Keys are held only in the running Node process, are never returned to the browser after submission, and are cleared when the server stops. Use it to configure `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and `OPENAI_API_KEY` for local tests. Do not put real keys in GitHub, `hosting.json`, browser storage, or committed files.
