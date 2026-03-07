const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  sessionActive: false,
  listening: false,
  speaking: false,
  score: 0,
  mode: "Warmup",
  currentQuestion: "",
  lastAssistantLine: "",
  timerId: null,
  secondsLeft: 0,
};

const ui = {
  statusPill: document.getElementById("status-pill"),
  orb: document.getElementById("session-toggle"),
  orbLabel: document.querySelector(".orb-label"),
  pttButton: document.getElementById("ptt-button"),
  repeatButton: document.getElementById("repeat-button"),
  conversationLog: document.getElementById("conversation-log"),
  modeText: document.getElementById("mode-text"),
  scoreText: document.getElementById("score-text"),
  timerText: document.getElementById("timer-text"),
  engineNote: document.getElementById("engine-note"),
};

let recognition = null;
let pttActive = false;
let askTimeout = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.listening = true;
    renderState();
  };

  recognition.onend = () => {
    state.listening = false;
    renderState();

    // Keep passive listening alive during active session except while speaking.
    if (state.sessionActive && !state.speaking && !pttActive) {
      startListening();
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== "no-speech") {
      appendEntry("assistant", `Voice error: ${event.error}.`);
      setStatus("error", "Voice Error");
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript) return;
    appendEntry("user", transcript);
    handleUserInput(transcript.toLowerCase());
  };
}

function setStatus(type, label) {
  ui.statusPill.className = `status-pill ${type}`;
  ui.statusPill.textContent = label;
}

function renderState() {
  if (!SpeechRecognition) {
    setStatus("error", "No Speech API");
    ui.engineNote.textContent = "Use Chrome/Edge for voice features.";
    return;
  }

  if (!state.sessionActive) {
    setStatus("idle", "Idle");
    ui.engineNote.textContent = "Mic ready";
    ui.orb.classList.remove("active", "speaking");
    ui.orbLabel.textContent = "Start Session";
    ui.pttButton.disabled = true;
    return;
  }

  ui.pttButton.disabled = false;
  ui.orbLabel.textContent = "Stop Session";

  if (state.speaking) {
    setStatus("speaking", "Speaking");
    ui.engineNote.textContent = "AI is talking";
    ui.orb.classList.add("active", "speaking");
    return;
  }

  if (state.listening) {
    setStatus("listening", "Listening");
    ui.engineNote.textContent = "Listening for your answer";
    ui.orb.classList.add("active");
    ui.orb.classList.remove("speaking");
    return;
  }

  setStatus("idle", "Thinking");
  ui.engineNote.textContent = "Preparing";
  ui.orb.classList.remove("speaking");
}

function appendEntry(role, text) {
  const item = document.createElement("article");
  item.className = `entry ${role}`;

  const head = document.createElement("p");
  head.className = "entry-head";
  head.textContent = role === "assistant" ? "AI Quizzer Coach" : "You";

  const body = document.createElement("p");
  body.className = "entry-text";
  body.textContent = text;

  item.append(head, body);
  ui.conversationLog.appendChild(item);
  ui.conversationLog.scrollTop = ui.conversationLog.scrollHeight;
}

function speak(text) {
  if (!text) return;
  state.speaking = true;
  state.lastAssistantLine = text;
  renderState();
  appendEntry("assistant", text);

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;

  utter.onend = () => {
    state.speaking = false;
    renderState();
    if (state.sessionActive && !pttActive) {
      startListening();
    }
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function startListening() {
  if (!recognition || state.listening || state.speaking) return;
  try {
    recognition.start();
  } catch (_err) {
    // Ignore repeated starts caused by fast state transitions.
  }
}

function stopListening() {
  if (!recognition || !state.listening) return;
  recognition.stop();
}

function startTimer(seconds = 30) {
  clearInterval(state.timerId);
  state.secondsLeft = seconds;
  ui.timerText.textContent = `${state.secondsLeft}s`;

  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    ui.timerText.textContent = state.secondsLeft > 0 ? `${state.secondsLeft}s` : "0s";

    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      state.timerId = null;
      speak("Time. We'll move to the next question.");
      queueQuestion();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
  ui.timerText.textContent = "--";
}

function queueQuestion() {
  clearTimeout(askTimeout);
  askTimeout = setTimeout(() => {
    state.currentQuestion = "According to Romans chapter one, who was set apart for the gospel of God?";
    speak(`Question: ${state.currentQuestion}`);
    startTimer(30);
  }, 500);
}

function startSession() {
  state.sessionActive = true;
  state.mode = "Quiz Mode";
  state.score = 0;
  state.currentQuestion = "";
  ui.modeText.textContent = state.mode;
  ui.scoreText.textContent = String(state.score);
  renderState();
  speak("Session started. Say start quiz when you are ready for question one.");
}

function stopSession() {
  state.sessionActive = false;
  state.speaking = false;
  state.listening = false;
  state.mode = "Warmup";
  state.currentQuestion = "";
  clearTimeout(askTimeout);
  stopTimer();
  speechSynthesis.cancel();
  stopListening();
  ui.modeText.textContent = state.mode;
  renderState();
  appendEntry("assistant", "Session stopped.");
}

function evaluateAnswer(input) {
  if (!state.currentQuestion) {
    speak("I heard you. Say start quiz to begin the question flow.");
    return;
  }

  stopTimer();
  const isCorrect = input.includes("paul");
  if (isCorrect) {
    state.score += 20;
    ui.scoreText.textContent = String(state.score);
    speak(`Correct. You earn 20 points. Score is now ${state.score}.`);
  } else {
    state.score -= 10;
    ui.scoreText.textContent = String(state.score);
    speak(`Incorrect. The expected answer was Paul. Score is now ${state.score}.`);
  }
  state.currentQuestion = "";
  queueQuestion();
}

function handleUserInput(input) {
  if (!state.sessionActive) {
    if (input.includes("start")) {
      startSession();
    } else {
      speak("Say start session to begin.");
    }
    return;
  }

  if (input.includes("stop session") || input === "stop") {
    stopSession();
    return;
  }

  if (input.includes("repeat")) {
    if (state.currentQuestion) {
      speak(`Repeating. ${state.currentQuestion}`);
      startTimer(state.secondsLeft || 30);
    } else if (state.lastAssistantLine) {
      speak(`Repeating. ${state.lastAssistantLine}`);
    } else {
      speak("There is nothing to repeat yet.");
    }
    return;
  }

  if (input.includes("score")) {
    speak(`Current score is ${state.score}.`);
    return;
  }

  if (input.includes("start quiz")) {
    queueQuestion();
    return;
  }

  if (input.includes("jump")) {
    if (state.currentQuestion) {
      speak("Jump registered. Complete the question and answer now.");
      startTimer(15);
    } else {
      speak("Jump registered. Waiting for the next question.");
    }
    return;
  }

  evaluateAnswer(input);
}

ui.orb.addEventListener("click", () => {
  if (!state.sessionActive) {
    startSession();
  } else {
    stopSession();
  }
});

ui.repeatButton.addEventListener("click", () => {
  if (!state.sessionActive) return;
  if (state.currentQuestion) {
    speak(`Repeating question. ${state.currentQuestion}`);
    startTimer(state.secondsLeft || 30);
  } else {
    speak("No active question to repeat.");
  }
});

ui.pttButton.addEventListener("pointerdown", () => {
  if (!state.sessionActive) return;
  pttActive = true;
  stopListening();
  startListening();
});

ui.pttButton.addEventListener("pointerup", () => {
  pttActive = false;
  stopListening();
});

ui.pttButton.addEventListener("pointercancel", () => {
  pttActive = false;
  stopListening();
});

if (!SpeechRecognition) {
  appendEntry("assistant", "This browser does not support Web Speech API. Open in latest Edge or Chrome.");
  ui.pttButton.disabled = true;
  ui.orb.disabled = true;
}

appendEntry("assistant", "Voice UI ready. Tap Start Session, then say: start quiz.");
renderState();
