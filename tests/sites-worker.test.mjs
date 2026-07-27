import assert from 'node:assert/strict';
import test from 'node:test';

const workerUrl = new URL('../dist/server/index.js', import.meta.url);
const worker = (await import(workerUrl)).default;

async function request(path, method = 'GET', body) {
  return worker.fetch(new Request(`https://quizbiblo.test${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }));
}

test('serves the current site version', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>QuizBiblo<\/title>/);
  assert.match(html, /Build version: 0\.1\.4/);
  assert.doesNotMatch(html, /buzz test|live-room demo/i);
});

test('supports the two-player room lifecycle', async () => {
  const host = { roomCode: 'TEST13', name: 'Ruth', playerId: 'host-13' };
  const guest = { roomCode: 'TEST13', name: 'Naomi', playerId: 'guest-13' };

  assert.equal((await request('/api/rooms/join', 'POST', host)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', guest)).status, 200);

  const started = await request(`/api/rooms/${host.roomCode}/start`, 'POST', { playerId: host.playerId });
  assert.equal(started.status, 200);
  const startedState = await started.json();

  const firstBuzz = await request('/api/rooms/TEST13/buzz', 'POST', { playerId: guest.playerId, attemptId: startedState.attemptId });
  const firstBody = await firstBuzz.json();
  assert.equal(firstBody.accepted, true);
  assert.equal(firstBody.room.winnerId, guest.playerId);
  assert.equal(firstBody.stale, undefined);

  const secondBuzz = await request('/api/rooms/TEST13/buzz', 'POST', { playerId: host.playerId, attemptId: startedState.attemptId });
  assert.equal(secondBuzz.status, 200);
  const secondBody = await secondBuzz.json();
  assert.equal(secondBody.accepted, false);
  assert.equal(secondBody.room.winnerId, guest.playerId);
});

test('supports Issue 2 race-safe first buzz and stale attempts', async () => {
  const host = { roomCode: 'TEST14', name: 'Mara', playerId: 'host-14' };
  const guest = { roomCode: 'TEST14', name: 'Liam', playerId: 'guest-14' };
  const rival = { roomCode: 'TEST14', name: 'Noah', playerId: 'rival-14' };

  assert.equal((await request('/api/rooms/join', 'POST', host)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', guest)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', rival)).status, 409);

  const started = await request(`/api/rooms/${host.roomCode}/start`, 'POST', { playerId: host.playerId });
  assert.equal(started.status, 200);
  const startBody = await started.json();
  assert.ok(startBody.attemptId > 0);

  const first = request(`/api/rooms/${host.roomCode}/buzz`, 'POST', { playerId: host.playerId, attemptId: startBody.attemptId });
  const second = request(`/api/rooms/${host.roomCode}/buzz`, 'POST', { playerId: guest.playerId, attemptId: startBody.attemptId });
  const race = await Promise.all([first, second]);
  const raceBody = await Promise.all(race.map((response) => response.json()));
  assert.equal(raceBody.filter((result) => result.accepted === true).length, 1);

  const stale = await request(`/api/rooms/${host.roomCode}/buzz`, 'POST', {
    playerId: guest.playerId,
    attemptId: startBody.attemptId + 100,
  });
  const staleBody = await stale.json();
  assert.equal(staleBody.accepted, false);
  assert.equal(staleBody.stale, true);
});
