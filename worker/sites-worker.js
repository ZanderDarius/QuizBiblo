const textEncoder = new TextEncoder();
const ROOM_TTL_MS = 30 * 60 * 1000;
const POLL_MS = 700;
const questions = [
  'According to John 11:25, who said, "I am the resurrection and the life"?',
  'To whom did Jesus say, "I am the resurrection and the life"?',
  'Who baptized Jesus?',
  'What was the name of the man Jesus raised from the dead in John 11?',
];

const rooms = new Map();
const assets = new Map([
  ['/', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/index.html', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/styles.css', { body: __STYLES_CSS__, type: 'text/css; charset=utf-8' }],
  ['/script.js', { body: __SCRIPT_JS__, type: 'text/javascript; charset=utf-8' }],
]);

let d1Initialized = false;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function toSafeInt(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function now() {
  return Date.now();
}

function cleanCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function safeName(value) {
  return String(value || '').trim().slice(0, 24);
}

function safePlayerId(value) {
  return String(value || '').trim().slice(0, 80);
}

function questionText(room) {
  if (room.questionIndex < 0) return null;
  return questions[room.questionIndex % questions.length] || null;
}

function snapshot(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    players: room.players.map(({ id, name }) => ({ id, name })),
    state: room.state,
    questionNumber: room.questionIndex < 0 ? 0 : room.questionIndex + 1,
    question: questionText(room),
    questionStartedAt: room.questionStartedAt || null,
    attemptId: room.attemptId,
    winnerId: room.winnerId,
    sequence: room.sequence,
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

function hasD1(env) {
  return Boolean(env && env.DB && typeof env.DB.prepare === 'function');
}

function parsePlayers(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRoom(rawRoom) {
  if (!rawRoom) return null;
  return {
    code: rawRoom.room_code,
    hostId: rawRoom.host_id,
    state: rawRoom.state,
    questionIndex: toSafeInt(rawRoom.question_index, -1),
    attemptId: toSafeInt(rawRoom.attempt_id, 0),
    sequence: toSafeInt(rawRoom.sequence, 0),
    winnerId: rawRoom.winner_id || null,
    questionStartedAt: rawRoom.question_started_at ? Number(rawRoom.question_started_at) : null,
    expiresAt: toSafeInt(rawRoom.expires_at, now()),
    players: parsePlayers(rawRoom.players_json),
  };
}

function createRoomSnapshot(code, hostId, name) {
  return {
    code,
    hostId,
    players: [{ id: hostId, name }],
    state: 'waiting',
    questionIndex: -1,
    attemptId: 0,
    sequence: 0,
    winnerId: null,
    questionStartedAt: null,
    expiresAt: now() + ROOM_TTL_MS,
  };
}

function roomFromPath(pathname) {
  const match = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/|$)/);
  return match ? match[1] : null;
}

function buildRoomStateResponse(room) {
  const roomSnapshot = snapshot(room);
  return {
    room: roomSnapshot,
    question: roomSnapshot.question,
    questionNumber: roomSnapshot.questionNumber,
    questionStartedAt: roomSnapshot.questionStartedAt,
    attemptId: roomSnapshot.attemptId,
    sequence: roomSnapshot.sequence,
  };
}

function ensureMemoryRoomDefaults(code, hostId, name) {
  if (!rooms.has(code)) {
    rooms.set(code, createRoomSnapshot(code, hostId, name));
  }
  const room = rooms.get(code);
  room.expiresAt = now() + ROOM_TTL_MS;
  return room;
}

function cleanExpiredMemory() {
  const cutoff = now();
  for (const [code, room] of rooms.entries()) {
    if (room.expiresAt < cutoff) rooms.delete(code);
  }
}

async function initD1(env) {
  if (d1Initialized) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS rooms (
      room_code TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      state TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      attempt_id INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      winner_id TEXT,
      question_started_at INTEGER,
      expires_at INTEGER NOT NULL,
      players_json TEXT NOT NULL
    )`,
  ).run();
  d1Initialized = true;
}

async function cleanupD1(env) {
  await env.DB.prepare('DELETE FROM rooms WHERE expires_at < ?').bind(now()).run();
}

async function findRoomD1(env, code) {
  const { results } = await env.DB.prepare(
    `SELECT room_code, host_id, state, question_index, attempt_id, sequence,
            winner_id, question_started_at, expires_at, players_json
       FROM rooms
      WHERE room_code = ?`,
  ).bind(code).all();
  return normalizeRoom(results?.[0]);
}

async function countD1(env) {
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS count FROM rooms').all();
  return toSafeInt(results?.[0]?.count, 0);
}

async function upsertRoomD1(env, room) {
  await env.DB.prepare(
    `INSERT INTO rooms (
        room_code, host_id, state, question_index, attempt_id, sequence,
        winner_id, question_started_at, expires_at, players_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_code) DO UPDATE SET
       host_id = COALESCE(rooms.host_id, excluded.host_id),
       state = excluded.state,
       question_index = excluded.question_index,
       attempt_id = excluded.attempt_id,
       sequence = excluded.sequence,
       winner_id = excluded.winner_id,
       question_started_at = excluded.question_started_at,
       expires_at = excluded.expires_at,
       players_json = excluded.players_json`,
  ).bind(
    room.code,
    room.hostId,
    room.state,
    room.questionIndex,
    room.attemptId,
    room.sequence,
    room.winnerId,
    room.questionStartedAt,
    room.expiresAt,
    JSON.stringify(room.players),
  ).run();
}

function bumpSequence(room) {
  room.sequence += 1;
  room.expiresAt = now() + ROOM_TTL_MS;
}

async function ensureRoomD1(env, code, playerId, name) {
  await initD1(env);
  await cleanupD1(env);

  const placeholderPlayers = JSON.stringify([{ id: playerId, name }]);
  await env.DB.prepare(
    `INSERT INTO rooms (
      room_code, host_id, state, question_index, attempt_id, sequence,
      winner_id, question_started_at, expires_at, players_json
    ) VALUES (?, ?, 'waiting', -1, 0, 0, NULL, NULL, ?, ?)`,
  ).bind(code, playerId, now() + ROOM_TTL_MS, placeholderPlayers).run().catch((error) => {
    if (!error || !String(error.message).includes('UNIQUE')) {
      throw error;
    }
  });

  const room = await findRoomD1(env, code);
  if (!room) return null;

  const existingIndex = room.players.findIndex((entry) => entry.id === playerId);
  if (existingIndex >= 0) {
    if (room.players[existingIndex].name !== name) {
      room.players[existingIndex].name = name;
      bumpSequence(room);
    }
  } else if (room.players.length < 2) {
    room.players.push({ id: playerId, name });
    bumpSequence(room);
  } else {
    const err = new Error('This demo room already has two players.');
    err.code = 409;
    throw err;
  }

  await upsertRoomD1(env, room);
  return room;
}

async function ensureRoomMemory(code, playerId, name) {
  cleanExpiredMemory();
  const room = ensureMemoryRoomDefaults(code, playerId, name);
  const known = room.players.find((entry) => entry.id === playerId);
  if (known) {
    if (known.name !== name) {
      known.name = name;
      room.sequence += 1;
      room.expiresAt = now() + ROOM_TTL_MS;
    }
    return room;
  }

  if (room.players.length >= 2) {
    const err = new Error('This demo room already has two players.');
    err.code = 409;
    throw err;
  }
  room.players.push({ id: playerId, name });
  room.sequence += 1;
  room.expiresAt = now() + ROOM_TTL_MS;
  return room;
}

function requirePlayer(room, playerId) {
  if (!room.players.some((entry) => entry.id === playerId)) {
    const error = new Error('Join the room first.');
    error.code = 403;
    throw error;
  }
}

function requireHost(room, playerId) {
  if (room.hostId !== playerId) {
    const error = new Error('Only the room host can start a question.');
    error.code = 403;
    throw error;
  }
}

async function loadRoomState(env, code) {
  if (!env || !env.DB) {
    cleanExpiredMemory();
    return rooms.get(code) || null;
  }
  await initD1(env);
  await cleanupD1(env);
  return findRoomD1(env, code);
}

async function startAttemptD1(env, room, playerId) {
  requireHost(room, playerId);
  if (room.players.length < 2) {
    const err = new Error('Wait for a second player to join.');
    err.code = 409;
    throw err;
  }
  if (room.state === 'reading' || room.state === 'locked') return room;

  const nextQuestionIndex = (room.questionIndex + 1) % questions.length;
  const startAt = now();
  const updateResult = await env.DB.prepare(
    `UPDATE rooms
        SET state = 'reading',
            question_index = ?,
            attempt_id = attempt_id + 1,
            sequence = sequence + 1,
            winner_id = NULL,
            question_started_at = ?,
            expires_at = ?
      WHERE room_code = ?
        AND state IN ('waiting', 'resolved')`,
  ).bind(nextQuestionIndex, startAt, startAt + ROOM_TTL_MS, room.code).run();
  if (updateResult.meta?.changes !== 1) {
    return (await loadRoomState(env, room.code)) || room;
  }
  return findRoomD1(env, room.code);
}

function startAttemptMemory(room, playerId) {
  requireHost(room, playerId);
  if (room.players.length < 2) {
    const err = new Error('Wait for a second player to join.');
    err.code = 409;
    throw err;
  }
  if (room.state === 'reading' || room.state === 'locked') return room;
  room.questionIndex = (room.questionIndex + 1) % questions.length;
  room.questionStartedAt = now();
  room.state = 'reading';
  room.winnerId = null;
  room.attemptId += 1;
  room.sequence += 1;
  room.expiresAt = now() + ROOM_TTL_MS;
  return room;
}

async function buzzAttemptD1(env, room, playerId, attemptId) {
  requirePlayer(room, playerId);
  if (attemptId !== room.attemptId) return { accepted: false, stale: true, room };
  if (room.state !== 'reading') return { accepted: false, stale: false, room };
  if (room.winnerId === playerId) return { accepted: true, room };

  const updateResult = await env.DB.prepare(
    `UPDATE rooms
        SET winner_id = ?,
            sequence = sequence + 1,
            state = 'locked'
      WHERE room_code = ?
        AND attempt_id = ?
        AND state = 'reading'
        AND winner_id IS NULL`,
  ).bind(playerId, room.code, room.attemptId).run();

  if (updateResult.meta?.changes === 1) {
    return { accepted: true, room: await findRoomD1(env, room.code) };
  }

  return {
    accepted: false,
    stale: false,
    room: await findRoomD1(env, room.code),
  };
}

function buzzAttemptMemory(room, playerId, attemptId) {
  requirePlayer(room, playerId);
  if (attemptId !== room.attemptId) return { accepted: false, stale: true, room };
  if (room.state !== 'reading') return { accepted: false, stale: false, room };
  if (room.winnerId === playerId) return { accepted: true, room };
  if (room.winnerId) return { accepted: false, stale: false, room };

  room.winnerId = playerId;
  room.state = 'locked';
  room.sequence += 1;
  room.expiresAt = now() + ROOM_TTL_MS;
  return { accepted: true, room };
}

function streamEvents(code, playerId, request, env) {
  let timer;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendRoom = async () => {
        if (closed) return;
        try {
          const room = await loadRoomState(env, code);
          if (!room) {
            emit(controller, 'error', { error: 'Room no longer exists.' });
            controller.close();
            return;
          }
          if (!room.players.some((entry) => entry.id === playerId)) {
            emit(controller, 'error', { error: 'Join the room first.' });
            controller.close();
            return;
          }
          emit(controller, 'snapshot', snapshot(room));
          return room.sequence;
        } catch (error) {
          emit(controller, 'error', { error: error instanceof Error ? error.message : 'Unable to read room.' });
          controller.close();
          return null;
        }
      };

      let lastSequence = -1;
      const first = await sendRoom();
      if (typeof first === 'number') lastSequence = first;

      timer = setInterval(async () => {
        if (closed) return;
        const sequence = await sendRoom();
        if (typeof sequence === 'number' && sequence !== lastSequence) {
          lastSequence = sequence;
          const room = await loadRoomState(env, code);
          if (!room) {
            emit(controller, 'error', { error: 'Room no longer exists.' });
            controller.close();
            clearInterval(timer);
            return;
          }
          emit(controller, 'room', snapshot(room));
        }
      }, POLL_MS);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });
  request.signal.addEventListener('abort', () => {
    closed = true;
    if (timer) clearInterval(timer);
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}

async function handleApi(request, url, env) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    if (hasD1(env)) {
      await initD1(env);
      await cleanupD1(env);
      return json({ ok: true, rooms: await countD1(env) });
    }
    cleanExpiredMemory();
    return json({ ok: true, rooms: rooms.size });
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
    const input = await request.json();
    const code = cleanCode(input.roomCode);
    const name = safeName(input.name);
    const playerId = safePlayerId(input.playerId);
    if (!code || !name || !playerId) return json({ error: 'Room code and display name are required.' }, 400);

    if (hasD1(env)) {
      try {
        const room = await ensureRoomD1(env, code, playerId, name);
        if (!room) return json({ error: 'Unable to join room.' }, 500);
        return json(snapshot(room));
      } catch (error) {
        return json({ error: error.message || 'Unable to join room.' }, error.code || 400);
      }
    }

    try {
      const room = await ensureRoomMemory(code, playerId, name);
      return json(snapshot(room));
    } catch (error) {
      return json({ error: error.message || 'Unable to join room.' }, error.code || 400);
    }
  }

  const code = roomFromPath(url.pathname);
  if (!code) return json({ error: 'Room not found.' }, 404);

  if (request.method === 'GET' && url.pathname.endsWith('/events')) {
    const playerId = url.searchParams.get('playerId');
    if (!playerId) return json({ error: 'Join the room first.' }, 403);
    const room = await loadRoomState(env, code);
    if (!room) return json({ error: 'Room not found.' }, 404);
    if (!room.players.some((entry) => entry.id === playerId)) return json({ error: 'Join the room first.' }, 403);
    return streamEvents(code, playerId, request, env);
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const input = await request.json();
  const playerId = safePlayerId(input.playerId);
  const attemptId = toSafeInt(input.attemptId, 0);

  if (hasD1(env)) {
    const room = await loadRoomState(env, code);
    if (!room) return json({ error: 'Room not found.' }, 404);
    if (!room.players.some((entry) => entry.id === playerId)) return json({ error: 'Join the room first.' }, 403);

    if (url.pathname.endsWith('/start')) {
      try {
        const started = await startAttemptD1(env, room, playerId);
        const latest = await findRoomD1(env, started.code);
        return json(buildRoomStateResponse(latest));
      } catch (error) {
        return json({ error: error.message }, error.code || 400);
      }
    }

    if (url.pathname.endsWith('/buzz')) {
      const result = await buzzAttemptD1(env, room, playerId, attemptId);
      if (result.accepted) return json({ accepted: true, ...buildRoomStateResponse(result.room || room) });
      return json({
        accepted: false,
        stale: Boolean(result.stale),
        winnerId: result.room?.winnerId || null,
        ...buildRoomStateResponse(result.room || room),
      });
    }
  } else {
    const room = rooms.get(code);
    if (!room) return json({ error: 'Room not found.' }, 404);
    if (!room.players.some((entry) => entry.id === playerId)) return json({ error: 'Join the room first.' }, 403);

    if (url.pathname.endsWith('/start')) {
      try {
        const started = startAttemptMemory(room, playerId);
        return json(buildRoomStateResponse(started));
      } catch (error) {
        return json({ error: error.message }, error.code || 400);
      }
    }

    if (url.pathname.endsWith('/buzz')) {
      const result = buzzAttemptMemory(room, playerId, attemptId);
      if (result.accepted) return json({ accepted: true, ...buildRoomStateResponse(result.room || room) });
      return json({
        accepted: false,
        stale: Boolean(result.stale),
        winnerId: result.room?.winnerId || null,
        ...buildRoomStateResponse(result.room || room),
      });
    }
  }

  return json({ error: 'Unknown room action.' }, 404);
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      const asset = assets.get(url.pathname);
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(asset.body, {
        headers: { 'content-type': asset.type, 'cache-control': 'no-store' },
      });
    }

    try {
      return await handleApi(request, url, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
  },
};
