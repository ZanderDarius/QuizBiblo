const $ = (selector) => document.querySelector(selector);
const state = { playerId: localStorage.getItem('quizbiblo-player-id') || crypto.randomUUID(), roomCode: '', name: '', isHost: false, phase: 'lobby', reader: null, question: '' };
localStorage.setItem('quizbiblo-player-id', state.playerId);

const nameInput = $('#nameInput');
const roomInput = $('#roomInput');
const questionText = $('#questionText');
const buzzBtn = $('#buzzBtn');
const startBtn = $('#startBtn');
const readingState = $('#readingState');
const roundStatus = $('#roundStatus');
const connectionStatus = $('#connectionStatus');

function makeRoomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function roomCode() { return roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
async function post(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to reach the room.');
  return data;
}
async function joinRoom(create) {
  const name = nameInput.value.trim();
  const code = create ? makeRoomCode() : roomCode();
  if (!name || !code) { readingState.textContent = 'Enter a display name and room code.'; return; }
  try {
    const joined = await post('/api/rooms/join', { roomCode: code, name, playerId: state.playerId });
    state.roomCode = joined.roomCode; state.name = name; state.isHost = joined.hostId === state.playerId;
    $('#lobby').hidden = true; $('#match').hidden = false; $('#roomCode').textContent = state.roomCode;
    startBtn.hidden = !state.isHost; connectionStatus.textContent = 'Connected';
    connectEvents(); renderRoom(joined);
  } catch (error) { readingState.textContent = error.message; }
}
function connectEvents() {
  if (state.events) state.events.close();
  state.events = new EventSource(`/api/rooms/${state.roomCode}/events?playerId=${encodeURIComponent(state.playerId)}`);
  state.events.addEventListener('snapshot', event => renderRoom(JSON.parse(event.data)));
  state.events.addEventListener('room', event => renderRoom(JSON.parse(event.data)));
  state.events.addEventListener('start', event => beginReading(JSON.parse(event.data)));
  state.events.addEventListener('buzz', event => showBuzz(JSON.parse(event.data)));
  state.events.onerror = () => { connectionStatus.textContent = 'Reconnecting…'; };
  state.events.onopen = () => { connectionStatus.textContent = 'Connected'; };
}
function renderRoom(room) {
  $('#playerList').innerHTML = room.players.map(player => `<li class="${player.id === state.playerId ? 'you' : ''}">${player.name}${player.id === room.hostId ? ' · host' : ''}${player.id === state.playerId ? ' · you' : ''}</li>`).join('');
  if (state.isHost) { startBtn.disabled = room.players.length < 2 || room.state === 'reading'; startBtn.textContent = room.questionNumber ? 'Start next question' : 'Start question'; }
  if (room.players.length < 2) roundStatus.textContent = 'Waiting for second player';
}
function beginReading(data) {
  clearInterval(state.reader); state.phase = 'reading'; state.question = data.question; buzzBtn.disabled = false;
  roundStatus.textContent = `Question ${data.questionNumber} is live`; readingState.textContent = 'Press Space now — first server-received buzz wins.';
  const words = data.question.split(/\s+/); const render = () => { const count = Math.min(words.length, Math.floor((Date.now() - data.startAt) / 125) + 1); questionText.textContent = words.slice(0, Math.max(0, count)).join(' '); if (count >= words.length) { clearInterval(state.reader); readingState.textContent = 'Question complete — buzz test remains open.'; } };
  render(); state.reader = setInterval(render, 80);
}
function showBuzz(data) {
  clearInterval(state.reader); state.phase = 'locked'; buzzBtn.disabled = true;
  const mine = data.winnerId === state.playerId;
  roundStatus.textContent = mine ? 'You buzzed first!' : `${data.winnerName} buzzed first`;
  readingState.textContent = mine ? 'The room is locked to your buzz. Ask the host to start the next test.' : 'Your buzzer is locked. Wait for the host to start the next test.';
}
async function buzz() {
  if (state.phase !== 'reading') return;
  buzzBtn.disabled = true;
  try { const result = await post(`/api/rooms/${state.roomCode}/buzz`, { playerId: state.playerId }); if (!result.accepted) showBuzz(result); } catch (error) { readingState.textContent = error.message; }
}
startBtn.addEventListener('click', async () => { try { await post(`/api/rooms/${state.roomCode}/start`, { playerId: state.playerId }); } catch (error) { readingState.textContent = error.message; } });
buzzBtn.addEventListener('click', buzz);
$('#createRoomBtn').addEventListener('click', () => joinRoom(true));
$('#joinRoomBtn').addEventListener('click', () => joinRoom(false));
document.addEventListener('keydown', event => { if (event.code === 'Space' && state.phase === 'reading' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); buzz(); } });
