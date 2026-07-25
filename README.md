# QuizBiblo Two-Player Buzz Test

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

The server accepts the first buzz it receives, locks the other player out, and shows the same winner on both screens. This is a shared-room demo only; it does not yet score or judge answers.
