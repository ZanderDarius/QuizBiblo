const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3101);
const root = __dirname;
const rooms = new Map();
const devSecrets = {
  azureSpeechKey: '',
  azureSpeechRegion: 'eastus',
  openaiApiKey: '',
  openaiModel: 'gpt-4.1-mini',
};
const questions = [
  'According to John 11:25, who said, “I am the resurrection and the life”?',
  'To whom did Jesus say, “I am the resurrection and the life”?',
  'Who baptized Jesus?',
  'What was the name of the man Jesus raised from the dead in John 11?'
];
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

function send(response, status, body, type = 'application/json; charset=utf-8') { response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body)); }
function readJson(request) { return new Promise((resolve, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 20000) request.destroy(); }); request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid request.')); } }); }); }
function cleanCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function snapshot(room) { return { roomCode: room.code, hostId: room.hostId, players: [...room.players.values()].map(({ id, name }) => ({ id, name })), state: room.state, questionNumber: room.questionIndex + 1 }; }
function emit(response, event, payload) { response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`); }
function broadcast(room, event, payload) { for (const response of room.connections.values()) emit(response, event, payload); }
function broadcastRoom(room) { broadcast(room, 'room', snapshot(room)); }
function getRoom(url) { const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/|$)/); return match ? rooms.get(match[1]) : null; }
function isLoopback(request) { const address = String(request.socket.remoteAddress || '').replace(/^::ffff:/, ''); return address === '127.0.0.1' || address === '::1'; }
function devStatus() { return { azureSpeechConfigured: Boolean(devSecrets.azureSpeechKey), azureSpeechRegion: devSecrets.azureSpeechRegion, openaiConfigured: Boolean(devSecrets.openaiApiKey), openaiModel: devSecrets.openaiModel }; }
function escapeXml(value) { return String(value).replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]); }
function speechSsml(text) { return `<speak version="1.0" xml:lang="en-US"><voice name="en-US-JennyNeural">${escapeXml(text)}</voice></speak>`; }
async function synthesizeDevSpeech(text) {
  if (!devSecrets.azureSpeechKey) return { status: 503, body: { error: 'Azure Speech key is not configured.' } };
  const region = devSecrets.azureSpeechRegion || 'eastus';
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  let result;
  try {
    result = await fetch(endpoint, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': devSecrets.azureSpeechKey, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3' }, body: speechSsml(text) });
  } catch { return { status: 502, body: { error: 'Unable to reach Azure Speech.' } }; }
  if (!result.ok) return { status: result.status === 429 ? 429 : 502, body: { error: 'Azure Speech rejected the test request.' } };
  return { status: 200, audio: Buffer.from(await result.arrayBuffer()) };
}
async function testDevOpenAI() {
  if (!devSecrets.openaiApiKey) return { status: 503, body: { error: 'OpenAI API key is not configured.' } };
  let result;
  try {
    result = await fetch('https://api.openai.com/v1/models/' + encodeURIComponent(devSecrets.openaiModel), { headers: { Authorization: `Bearer ${devSecrets.openaiApiKey}` } });
  } catch { return { status: 502, body: { error: 'Unable to reach OpenAI.' } }; }
  if (!result.ok) return { status: result.status === 429 ? 429 : 502, body: { error: 'OpenAI rejected the connection test.' } };
  return { status: 200, body: { ok: true, model: devSecrets.openaiModel } };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith('/__dev/') && !isLoopback(request)) return send(response, 404, 'Not found', 'text/plain; charset=utf-8');
  if (request.method === 'GET' && url.pathname === '/__dev/settings') return fs.readFile(path.join(root, 'dev-settings.html'), (error, data) => error ? send(response, 404, 'Not found', 'text/plain; charset=utf-8') : send(response, 200, data, 'text/html; charset=utf-8'));
  if (request.method === 'GET' && url.pathname === '/__dev/status') return send(response, 200, devStatus());
  if (request.method === 'POST' && url.pathname === '/__dev/settings') {
    try {
      const input = await readJson(request);
      devSecrets.azureSpeechKey = String(input.azureSpeechKey || '').trim().slice(0, 512);
      devSecrets.azureSpeechRegion = String(input.azureSpeechRegion || 'eastus').trim().toLowerCase().slice(0, 32) || 'eastus';
      devSecrets.openaiApiKey = String(input.openaiApiKey || '').trim().slice(0, 512);
      devSecrets.openaiModel = String(input.openaiModel || 'gpt-4.1-mini').trim().slice(0, 128) || 'gpt-4.1-mini';
      return send(response, 200, devStatus());
    } catch (error) { return send(response, 400, { error: error.message }); }
  }
  if (request.method === 'POST' && url.pathname === '/__dev/speech/test') {
    try {
      const input = await readJson(request); const text = String(input.text || '').trim().slice(0, 500);
      if (!text) return send(response, 400, { error: 'Test text is required.' });
      const result = await synthesizeDevSpeech(text);
      if (result.audio) { response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }); return response.end(result.audio); }
      return send(response, result.status, result.body);
    } catch (error) { return send(response, 400, { error: error.message }); }
  }
  if (request.method === 'POST' && url.pathname === '/__dev/openai/test') {
    const result = await testDevOpenAI();
    return send(response, result.status, result.body);
  }
  if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { ok: true, rooms: rooms.size });

  if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
    try {
      const { roomCode, name, playerId } = await readJson(request); const code = cleanCode(roomCode); const safeName = String(name || '').trim().slice(0, 24); const safeId = String(playerId || '').trim().slice(0, 80);
      if (!code || !safeName || !safeId) return send(response, 400, { error: 'Room code and display name are required.' });
      let room = rooms.get(code); if (!room) { room = { code, hostId: safeId, players: new Map(), connections: new Map(), state: 'waiting', questionIndex: -1, winnerId: null }; rooms.set(code, room); }
      if (!room.players.has(safeId) && room.players.size >= 2) return send(response, 409, { error: 'This demo room already has two players.' });
      room.players.set(safeId, { id: safeId, name: safeName }); broadcastRoom(room); return send(response, 200, snapshot(room));
    } catch (error) { return send(response, 400, { error: error.message }); }
  }

  const room = getRoom(url);
  if (request.method === 'GET' && room && url.pathname.endsWith('/events')) {
    const playerId = url.searchParams.get('playerId'); if (!room.players.has(playerId)) return send(response, 403, { error: 'Join the room first.' });
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); response.write(': connected\n\n');
    const previous = room.connections.get(playerId); if (previous) previous.end(); room.connections.set(playerId, response); emit(response, 'snapshot', snapshot(room));
    request.on('close', () => { if (room.connections.get(playerId) === response) room.connections.delete(playerId); }); return;
  }
  if (request.method === 'POST' && room && url.pathname.endsWith('/start')) {
    try {
      const { playerId } = await readJson(request); if (playerId !== room.hostId) return send(response, 403, { error: 'Only the room host can start a question.' }); if (room.players.size < 2) return send(response, 409, { error: 'Wait for a second player to join.' });
      room.questionIndex = (room.questionIndex + 1) % questions.length; room.state = 'reading'; room.winnerId = null; const payload = { question: questions[room.questionIndex], questionNumber: room.questionIndex + 1, startAt: Date.now() }; broadcast(room, 'start', payload); broadcastRoom(room); return send(response, 200, payload);
    } catch (error) { return send(response, 400, { error: error.message }); }
  }
  if (request.method === 'POST' && room && url.pathname.endsWith('/buzz')) {
    try {
      const { playerId } = await readJson(request); if (!room.players.has(playerId)) return send(response, 403, { error: 'Join the room first.' });
      if (room.state !== 'reading' || room.winnerId) { const winner = room.players.get(room.winnerId); return send(response, 200, { accepted: false, winnerId: room.winnerId, winnerName: winner?.name || 'Another player' }); }
      room.winnerId = playerId; room.state = 'locked'; const winner = room.players.get(playerId); const payload = { accepted: true, winnerId: playerId, winnerName: winner.name }; broadcast(room, 'buzz', payload); broadcastRoom(room); return send(response, 200, payload);
    } catch (error) { return send(response, 400, { error: error.message }); }
  }

  if (request.method !== 'GET') return send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname; const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root)) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(file, (error, data) => error ? send(response, 404, 'Not found', 'text/plain; charset=utf-8') : send(response, 200, data, contentTypes[path.extname(file)] || 'application/octet-stream'));
});
server.listen(port, () => console.log(`QuizBiblo buzz demo running at http://localhost:${port}`));
