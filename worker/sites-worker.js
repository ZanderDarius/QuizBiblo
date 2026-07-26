const textEncoder = new TextEncoder();
const rooms = new Map();
const questions = [
  'According to John 11:25, who said, "I am the resurrection and the life"?',
  'To whom did Jesus say, "I am the resurrection and the life"?',
  'Who baptized Jesus?',
  'What was the name of the man Jesus raised from the dead in John 11?',
];

const assets = new Map([
  ['/', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/index.html', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/styles.css', { body: __STYLES_CSS__, type: 'text/css; charset=utf-8' }],
  ['/script.js', { body: __SCRIPT_JS__, type: 'text/javascript; charset=utf-8' }],
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function cleanCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function snapshot(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map(({ id, name }) => ({ id, name })),
    state: room.state,
    questionNumber: room.questionIndex + 1,
  };
}

function eventChunk(event, payload) {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function emit(controller, event, payload) {
  try {
    controller.enqueue(eventChunk(event, payload));
    return true;
  } catch {
    return false;
  }
}

function broadcast(room, event, payload) {
  for (const [playerId, controller] of room.connections) {
    if (!emit(controller, event, payload)) room.connections.delete(playerId);
  }
}

function broadcastRoom(room) {
  broadcast(room, 'room', snapshot(room));
}

function roomFromPath(pathname) {
  const match = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/|$)/);
  return match ? rooms.get(match[1]) : null;
}

async function handleApi(request, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, rooms: rooms.size });
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
    const input = await request.json();
    const code = cleanCode(input.roomCode);
    const name = String(input.name || '').trim().slice(0, 24);
    const playerId = String(input.playerId || '').trim().slice(0, 80);
    if (!code || !name || !playerId) return json({ error: 'Room code and display name are required.' }, 400);

    let room = rooms.get(code);
    if (!room) {
      room = {
        code,
        hostId: playerId,
        players: new Map(),
        connections: new Map(),
        state: 'waiting',
        questionIndex: -1,
        winnerId: null,
      };
      rooms.set(code, room);
    }
    if (!room.players.has(playerId) && room.players.size >= 2) {
      return json({ error: 'This demo room already has two players.' }, 409);
    }
    room.players.set(playerId, { id: playerId, name });
    broadcastRoom(room);
    return json(snapshot(room));
  }

  const room = roomFromPath(url.pathname);
  if (!room) return json({ error: 'Room not found.' }, 404);

  if (request.method === 'GET' && url.pathname.endsWith('/events')) {
    const playerId = url.searchParams.get('playerId');
    if (!room.players.has(playerId)) return json({ error: 'Join the room first.' }, 403);

    let eventController;
    const stream = new ReadableStream({
      start(controller) {
        eventController = controller;
        room.connections.set(playerId, controller);
        emit(controller, 'snapshot', snapshot(room));
      },
      cancel() {
        if (room.connections.get(playerId) === eventController) room.connections.delete(playerId);
      },
    });
    request.signal.addEventListener('abort', () => {
      if (room.connections.get(playerId) === eventController) room.connections.delete(playerId);
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const { playerId } = await request.json();

  if (url.pathname.endsWith('/start')) {
    if (playerId !== room.hostId) return json({ error: 'Only the room host can start a question.' }, 403);
    if (room.players.size < 2) return json({ error: 'Wait for a second player to join.' }, 409);
    room.questionIndex = (room.questionIndex + 1) % questions.length;
    room.state = 'reading';
    room.winnerId = null;
    const payload = {
      question: questions[room.questionIndex],
      questionNumber: room.questionIndex + 1,
      startAt: Date.now(),
    };
    broadcast(room, 'start', payload);
    broadcastRoom(room);
    return json(payload);
  }

  if (url.pathname.endsWith('/buzz')) {
    if (!room.players.has(playerId)) return json({ error: 'Join the room first.' }, 403);
    if (room.state !== 'reading' || room.winnerId) {
      const winner = room.players.get(room.winnerId);
      return json({ accepted: false, winnerId: room.winnerId, winnerName: winner?.name || 'Another player' });
    }
    room.winnerId = playerId;
    room.state = 'locked';
    const winner = room.players.get(playerId);
    const payload = { accepted: true, winnerId: playerId, winnerName: winner.name };
    broadcast(room, 'buzz', payload);
    broadcastRoom(room);
    return json(payload);
  }

  return json({ error: 'Unknown room action.' }, 404);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, url);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid request.' }, 400);
      }
    }

    const asset = assets.get(url.pathname);
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(asset.body, {
      headers: { 'content-type': asset.type, 'cache-control': 'no-store' },
    });
  },
};
