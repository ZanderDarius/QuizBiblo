const $ = (selector) => document.querySelector(selector);
const state = {
  playerId: localStorage.getItem('quizbiblo-player-id') || crypto.randomUUID(),
  roomCode: '',
  name: '',
  isHost: false,
  questionBank: 'default',
  phase: 'lobby',
  reader: null,
  question: '',
  questionNumber: 0,
  roomCodeState: null,
  roomSequence: -1,
  attemptId: 0,
  roomQuestionStartedAt: null,
  questionStartAt: 0,
  events: null,
};
localStorage.setItem('quizbiblo-player-id', state.playerId);

const nameInput = $('#nameInput');
const roomInput = $('#roomInput');
const questionText = $('#questionText');
const buzzBtn = $('#buzzBtn');
const startBtn = $('#startBtn');
const readingState = $('#readingState');
const roundStatus = $('#roundStatus');
const connectionStatus = $('#connectionStatus');
const questionBankInput = $('#questionBankInput');
const questionFileInput = $('#questionFileInput');
const questionFormat = $('#questionFormat');
const publishOnImport = $('#publishOnImport');
const previewQuestionsBtn = $('#previewQuestionsBtn');
const importQuestionsBtn = $('#importQuestionsBtn');
const activateQuestionsBtn = $('#activateQuestionsBtn');
const importStatus = $('#importStatus');
const importPreview = $('#importPreview');

let pendingQuestionRevision = null;
let importedQuestionBank = state.questionBank;

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function roomCode() {
  return roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function post(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to reach the room.');
  return data;
}

async function requestJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function currentQuestionBank() {
  return String(questionBankInput.value || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsText(file);
  });
}

function inferredFileFormat(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.tsv')) return 'tsv';
  return 'csv';
}

function setImportStatus(message, isError = false) {
  importStatus.textContent = message;
  importStatus.style.color = isError ? '#7a1d1d' : '';
}

function showImportPreview(preview) {
  if (!preview?.length) {
    importPreview.hidden = true;
    importPreview.textContent = '';
    return;
  }
  importPreview.textContent = preview
    .map((row, index) => `${index + 1}. ${row.questionId} (${row.questionType}) — ${row.officialQuestion}`)
    .join('\n');
  importPreview.hidden = false;
}

function showImportErrors(errors) {
  if (!errors?.length) {
    importPreview.hidden = true;
    importPreview.textContent = '';
    return;
  }
  importPreview.textContent = errors
    .slice(0, 30)
    .map((error) => `Row ${error.row}, ${error.field}: ${error.message}`)
    .join('\n');
  importPreview.hidden = false;
}

function resetQuestionImportState(message = 'Upload CSV or TSV to preview before import.') {
  setImportStatus(message);
  importPreview.hidden = true;
  importPreview.textContent = '';
  pendingQuestionRevision = null;
  importedQuestionBank = currentQuestionBank();
  importQuestionsBtn.disabled = true;
  activateQuestionsBtn.disabled = true;
}

function playerListHtml(room) {
  return room.players.map((player) => `<li class="${player.id === state.playerId ? 'you' : ''}">${player.name}${player.id === room.hostId ? ' · host' : ''}${player.id === state.playerId ? ' · you' : ''}</li>`).join('');
}

function clearReader() {
  if (state.reader) {
    clearInterval(state.reader);
    state.reader = null;
  }
}

function renderRoom(room) {
  $('#playerList').innerHTML = playerListHtml(room);
  if (state.isHost) {
    startBtn.disabled = room.players.length < 2 || room.state !== 'waiting';
    startBtn.textContent = room.questionNumber ? 'Start next question' : 'Start question';
  }
  if (room.players.length < 2) {
    roundStatus.textContent = 'Waiting for second player';
    buzzBtn.disabled = true;
    return;
  }
}

function beginReading(room) {
  clearReader();
  state.phase = 'reading';
  state.question = room.question || '';
  state.questionStartAt = room.questionStartedAt || Date.now();
  state.questionNumber = room.questionNumber || 1;
  state.attemptId = room.attemptId || 0;
  state.roomQuestionStartedAt = room.questionStartedAt || null;
  state.question = room.question || '';
  buzzBtn.disabled = false;
  roundStatus.textContent = `Question ${state.questionNumber} is live`;
  readingState.textContent = 'Press Space now — first server-received buzz wins.';

  const words = state.question.split(/\s+/);
  const render = () => {
    const count = Math.min(words.length, Math.floor((Date.now() - state.questionStartAt) / 125) + 1);
    questionText.textContent = words.slice(0, Math.max(0, count)).join(' ');
    if (count >= words.length) {
      clearReader();
      readingState.textContent = 'Question complete — buzz lock is now closed.';
    }
  };
  render();
  state.reader = setInterval(() => render(), 80);
}

function showLocked(room) {
  clearReader();
  state.phase = 'locked';
  buzzBtn.disabled = true;
  const mine = room.winnerId === state.playerId;
  const winner = room.players.find((player) => player.id === room.winnerId);
  const winnerName = winner?.name || 'Opponent';
  roundStatus.textContent = mine ? 'You buzzed first!' : `${winnerName} buzzed first`;
  readingState.textContent = mine
    ? 'The room is locked to your buzz. Ask the host to start the next question.'
    : 'Your buzzer is locked. Wait for the host to start the next question.';
}

function applyRoomSnapshot(room) {
  if (typeof room.sequence === 'number' && room.sequence <= state.roomSequence) {
    return;
  }
  if (typeof room.sequence === 'number') state.roomSequence = room.sequence;

  renderRoom(room);

  if (room.state === 'waiting') {
    clearReader();
    state.phase = 'waiting';
    readingState.textContent = 'Waiting for host to start question.';
    buzzBtn.disabled = true;
    if (state.name && room.question) {
      questionText.textContent = room.question;
    }
    return;
  }

  if (room.state === 'reading') {
    const isSameAttempt = room.attemptId === state.attemptId;
    const isSameWindow = room.questionStartedAt === state.roomQuestionStartedAt;
    if (!isSameAttempt || !isSameWindow || state.phase !== 'reading') {
      beginReading(room);
      return;
    }
    if (state.phase !== 'reading') {
      beginReading(room);
    }
    if (state.attemptId !== room.attemptId || state.question !== room.question) {
      beginReading(room);
    }
    return;
  }

  if (room.state === 'locked') {
    showLocked(room);
    return;
  }

  readingState.textContent = 'Ready for next round.';
  clearReader();
  state.phase = 'waiting';
}

async function previewQuestions() {
  const file = questionFileInput.files?.[0];
  if (!file) {
    setImportStatus('Please choose a file first.', true);
    return;
  }
  const format = questionFormat.value || inferredFileFormat(file);
  if (/\.tsv$/i.test(file.name)) {
    questionFormat.value = 'tsv';
  }

  try {
    const content = await readFileAsText(file);
    const bankCode = currentQuestionBank();
    setImportStatus('Running preview...');
    const { ok, data } = await requestJson('/api/questions/preview', { bankCode, format, content });
    if (!ok) {
      pendingQuestionRevision = null;
      showImportErrors(data?.errors || []);
      setImportStatus(`Preview failed: ${data?.errorCount || 0} errors.`, true);
      importQuestionsBtn.disabled = true;
      activateQuestionsBtn.disabled = true;
      return;
    }
    importedQuestionBank = bankCode;
    showImportPreview(data?.preview || []);
    setImportStatus(`Preview ok: ${data.rowCount} rows, ${data.errorCount} errors.`);
    importQuestionsBtn.disabled = data.rowCount < 1;
    activateQuestionsBtn.disabled = true;
  } catch (error) {
    setImportStatus(error.message || 'Unable to preview questions.', true);
    showImportErrors([{ row: 1, field: 'content', message: error.message || 'Unable to preview questions.' }]);
  }
}

async function importQuestions() {
  const file = questionFileInput.files?.[0];
  if (!file) {
    setImportStatus('Please choose a file first.', true);
    return;
  }
  const format = questionFormat.value || inferredFileFormat(file);
  if (/\.tsv$/i.test(file.name)) {
    questionFormat.value = 'tsv';
  }

  try {
    const content = await readFileAsText(file);
    const bankCode = currentQuestionBank();
    setImportStatus('Importing questions...');
    const { ok, data } = await requestJson('/api/questions/import', {
      bankCode,
      format,
      content,
      publish: publishOnImport.checked,
    });
    if (!ok) {
      showImportErrors(data?.errors || []);
      setImportStatus(`Import failed: ${data?.error || 'Request failed.'}`, true);
      return;
    }
    importedQuestionBank = bankCode;
    pendingQuestionRevision = data.revision || null;
    setImportStatus(`Imported revision ${pendingQuestionRevision || 'n/a'} (${data.status}).`);
    importQuestionsBtn.disabled = true;
    activateQuestionsBtn.disabled = !!publishOnImport.checked || !pendingQuestionRevision;
    showImportPreview([]);
  } catch (error) {
    setImportStatus(error.message || 'Unable to import questions.', true);
  }
}

async function activateImportedRevision() {
  if (!pendingQuestionRevision) {
    setImportStatus('No revision is ready to activate.', true);
    return;
  }
  try {
    const bankCode = importedQuestionBank || currentQuestionBank();
    setImportStatus(`Activating revision ${pendingQuestionRevision}...`);
    const { ok, data } = await requestJson('/api/questions/activate', { bankCode, revision: pendingQuestionRevision });
    if (!ok) {
      setImportStatus(data?.error || 'Unable to activate revision.', true);
      return;
    }
    setImportStatus(`Activated revision ${data.revision} as live.`);
    activateQuestionsBtn.disabled = true;
  } catch (error) {
    setImportStatus(error.message || 'Unable to activate revision.', true);
  }
}

async function joinRoom(create) {
  const name = nameInput.value.trim();
  const code = create ? makeRoomCode() : roomCode();
  const bankCode = currentQuestionBank();
  if (!name || !code) {
    readingState.textContent = 'Enter a display name and room code.';
    return;
  }
  try {
    const joined = await post('/api/rooms/join', {
      roomCode: code,
      name,
      playerId: state.playerId,
      questionBank: bankCode,
    });
    state.roomCode = joined.roomCode;
    state.name = name;
    state.isHost = joined.hostId === state.playerId;
    state.questionBank = bankCode;
    state.attemptId = joined.attemptId || 0;
    state.roomSequence = joined.sequence || 0;
    $('#lobby').hidden = true;
    $('#match').hidden = false;
    $('#roomCode').textContent = state.roomCode;
    startBtn.hidden = !state.isHost;
    connectionStatus.textContent = 'Connected';
    connectEvents();
    applyRoomSnapshot(joined);
  } catch (error) {
    readingState.textContent = error.message;
  }
}

function connectEvents() {
  if (state.events) {
    state.events.close();
  }
  state.events = new EventSource(`/api/rooms/${state.roomCode}/events?playerId=${encodeURIComponent(state.playerId)}`);
  state.events.addEventListener('snapshot', (event) => applyRoomSnapshot(JSON.parse(event.data)));
  state.events.addEventListener('room', (event) => applyRoomSnapshot(JSON.parse(event.data)));
  state.events.onerror = () => {
    connectionStatus.textContent = 'Reconnecting…';
  };
  state.events.onopen = () => {
    connectionStatus.textContent = 'Connected';
  };
}

async function startQuestion() {
  try {
    const started = await post(`/api/rooms/${state.roomCode}/start`, { playerId: state.playerId });
    if (started.room) {
      applyRoomSnapshot(started.room);
      return;
    }
    if (started.question) {
      beginReading({ ...started, questionStartedAt: started.questionStartedAt || Date.now(), question: started.question });
    }
  } catch (error) {
    readingState.textContent = error.message;
  }
}

async function buzz() {
  if (state.phase !== 'reading') return;
  buzzBtn.disabled = true;
  try {
    const response = await post(`/api/rooms/${state.roomCode}/buzz`, {
      playerId: state.playerId,
      attemptId: state.attemptId,
      roomSequence: state.roomSequence,
    });
    if (response.room) {
      applyRoomSnapshot(response.room);
      return;
    }
    if (response.accepted) {
      applyRoomSnapshot({
        state: 'locked',
        winnerId: state.playerId,
        roomCode: state.roomCode,
        hostId: state.isHost ? state.playerId : '',
        players: $('#playerList').children.length ? [] : [],
        attemptId: response.attemptId || state.attemptId,
        sequence: state.roomSequence + 1,
        question: state.question,
        questionStartedAt: state.questionStartedAt,
        questionNumber: state.questionNumber,
      });
      return;
    }
    if (response.stale) {
      readingState.textContent = 'This action was stale. Please wait for current room state.';
      return;
    }
  } catch (error) {
    readingState.textContent = error.message;
  }
}

startBtn.addEventListener('click', startQuestion);
buzzBtn.addEventListener('click', buzz);
previewQuestionsBtn.addEventListener('click', previewQuestions);
importQuestionsBtn.addEventListener('click', importQuestions);
activateQuestionsBtn.addEventListener('click', activateImportedRevision);
questionFileInput.addEventListener('change', () => {
  resetQuestionImportState();
  const file = questionFileInput.files?.[0];
  if (file && /\.tsv$/i.test(file.name)) {
    questionFormat.value = 'tsv';
  }
});
questionFormat.addEventListener('change', resetQuestionImportState);
questionBankInput.addEventListener('input', () => {
  state.questionBank = currentQuestionBank();
  resetQuestionImportState();
});
publishOnImport.addEventListener('change', () => {
  activateQuestionsBtn.disabled = publishOnImport.checked || !pendingQuestionRevision;
});
$('#createRoomBtn').addEventListener('click', () => joinRoom(true));
$('#joinRoomBtn').addEventListener('click', () => joinRoom(false));

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && state.phase === 'reading' && document.activeElement.tagName !== 'INPUT') {
    event.preventDefault();
    buzz();
  }
});

resetQuestionImportState();
