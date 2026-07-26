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

  const started = await request('/api/rooms/TEST13/start', 'POST', { playerId: host.playerId });
  assert.equal(started.status, 200);

  const firstBuzz = await request('/api/rooms/TEST13/buzz', 'POST', { playerId: guest.playerId });
  assert.deepEqual(await firstBuzz.json(), {
    accepted: true,
    winnerId: guest.playerId,
    winnerName: guest.name,
  });

  const secondBuzz = await request('/api/rooms/TEST13/buzz', 'POST', { playerId: host.playerId });
  assert.deepEqual(await secondBuzz.json(), {
    accepted: false,
    winnerId: guest.playerId,
    winnerName: guest.name,
  });
});
