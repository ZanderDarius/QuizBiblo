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
  assert.match(html, /Build version: 0\.1\.6/);
  assert.doesNotMatch(html, /buzz test|live-room demo/i);
});

const CSV_SAMPLE = `question_id,question_type,official_question,spoken_question,expected_answer,accepted_answers,reference,explanation,intro_remarks,interruption_requirements,pronunciation_hints
QX1,Regular,What does 2 + 2 equal?,What does two plus two equal?,4,"4,four,forty",https://example.org/math-2-plus-2,Add two groups of two to get four.,Start with one slow breath.,Wait until the question ends.,Use "four" with a clear vowel.
QX2,Interrogative,Who wrote the "Hail Mary" prayer?,Who wrote the Hail Mary prayer?,Jerome,"Jerome,St. Jerome",https://example.org/hail-mary,Hail Mary is traditionally attributed in this game set.,Read name carefully.,Do not interrupt during speaker attribution.,Say "Huh".`;

const TSV_SAMPLE = `question_id\tquestion_type\tofficial_question\tspoken_question\texpected_answer\taccepted_answers\treference\texplanation\tintro_remarks\tinterruption_requirements\tpronunciation_hints
QY1\tRegular\tWhat is 3 + 1?\tWhat is three plus one?\t4\t4,four\thttps://example.org/math-3-plus-1\tSimple addition.\tUse a steady voice.\tDo not interrupt while reading.\tUse clear one-two-three-four pacing.
QY2\tInterrogative\tWhat is the color of grass?\tWhat is the color of grass?\tgreen\tgreen,emerald\thttps://example.org/grass\tPlants appear green due chlorophyll.\tRead clearly.\tNo interruptions until done.\tSay green like "greeen".`;

const DUPLICATE_ID_CSV = `question_id,question_type,official_question,spoken_question,expected_answer,accepted_answers,reference,explanation,intro_remarks,interruption_requirements,pronunciation_hints
QX1,Regular,First question,First question,one,"one",https://example.org/ok,ok,ok,no interrupt,voice one
QX1,Regular,Second question,Second question,two,"two",https://example.org/ok,ok,ok,no interrupt,voice two`;

const BAD_TYPE_CSV = `question_id,question_type,official_question,spoken_question,expected_answer,accepted_answers,reference,explanation,intro_remarks,interruption_requirements,pronunciation_hints
QZ1,Essay,Bad type question,Bad type question,yes,"yes",https://example.org/bad,Bad type row,No,No,No`;

const MARKUP_CSV = `question_id,question_type,official_question,spoken_question,expected_answer,accepted_answers,reference,explanation,intro_remarks,interruption_requirements,pronunciation_hints
QZ2,Regular,<b>script</b> bad,Spoken safe,ok,"ok",https://example.org/mark,This row has markup,No,No,No`;

const MISSING_FIELD_CSV = `question_id,question_type,official_question,spoken_question,expected_answer,accepted_answers,reference,explanation,intro_remarks,interruption_requirements,pronunciation_hints
QZ3,Regular,,Spoken question,ok,"ok",https://example.org/missing,Explanation,Intro,no interrupt,Hint`;

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

test('issues a preview for a valid CSV bank and imports it', async () => {
  const preview = await request('/api/questions/preview', 'POST', {
    bankCode: 'pilot',
    format: 'csv',
    content: CSV_SAMPLE,
  });
  const previewBody = await preview.json();
  assert.equal(previewBody.ok, true);
  assert.equal(previewBody.errorCount, 0);

  const imported = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot',
    format: 'csv',
    content: CSV_SAMPLE,
    publish: true,
  });
  const importBody = await imported.json();
  assert.equal(importBody.ok, true);
  assert.equal(importBody.bankCode, 'pilot');
  assert.equal(importBody.status, 'active');
  assert.equal(importBody.questionCount, 2);

  const host = { roomCode: 'PILOT1', name: 'Host', playerId: 'pilot-host', questionBank: 'pilot' };
  const guest = { roomCode: 'PILOT1', name: 'Guest', playerId: 'pilot-guest', questionBank: 'pilot' };
  assert.equal((await request('/api/rooms/join', 'POST', host)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', guest)).status, 200);

  const started = await request('/api/rooms/PILOT1/start', 'POST', { playerId: host.playerId, questionBank: 'pilot' });
  const startedBody = await started.json();
  assert.equal(startedBody.questionBank, 'pilot');
  assert.equal(startedBody.questionRevision, importBody.revision);
  assert.ok(startedBody.questionId);
});

test('imports TSV bank and rejects invalid rows with exact field errors', async () => {
  const tsvImport = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot2',
    format: 'tsv',
    content: TSV_SAMPLE,
    publish: true,
  });
  const tsvBody = await tsvImport.json();
  assert.equal(tsvBody.ok, true);

  const badDuplicate = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot2',
    format: 'csv',
    content: DUPLICATE_ID_CSV,
  });
  const badDuplicateBody = await badDuplicate.json();
  assert.equal(badDuplicate.status, 400);
  assert.equal(badDuplicateBody.ok, false);
  assert.equal(badDuplicateBody.errorCount >= 1, true);
  assert.equal(badDuplicateBody.errors.some((item) => item.field === 'questionId'), true);

  const badType = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot2',
    format: 'csv',
    content: BAD_TYPE_CSV,
  });
  const badTypeBody = await badType.json();
  assert.equal(badType.status, 400);
  assert.equal(badTypeBody.errors.some((item) => item.field === 'questionType'), true);

  const badMarkup = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot2',
    format: 'csv',
    content: MARKUP_CSV,
  });
  const badMarkupBody = await badMarkup.json();
  assert.equal(badMarkup.status, 400);
  assert.equal(badMarkupBody.errors.some((item) => item.field === 'officialQuestion'), true);

  const badMissing = await request('/api/questions/import', 'POST', {
    bankCode: 'pilot2',
    format: 'csv',
    content: MISSING_FIELD_CSV,
  });
  const badMissingBody = await badMissing.json();
  assert.equal(badMissing.status, 400);
  assert.equal(badMissingBody.errors.some((item) => item.field === 'officialQuestion'), true);
});

test('keeps an active revision stable until new revision is explicitly activated', async () => {
  const bankCode = 'switch';
  const importA = await request('/api/questions/import', 'POST', {
    bankCode,
    format: 'csv',
    content: CSV_SAMPLE,
    publish: true,
  });
  const activeA = await importA.json();
  assert.equal(activeA.ok, true);
  assert.equal(activeA.status, 'active');

  const host = { roomCode: 'SWITCH1', name: 'Host', playerId: 'switch-host' };
  const guest = { roomCode: 'SWITCH1', name: 'Guest', playerId: 'switch-guest' };
  const startImportA = await request('/api/questions/import', 'POST', {
    bankCode,
    format: 'csv',
    content: BAD_TYPE_CSV,
    publish: true,
  });
  assert.equal((await startImportA).status, 400);

  assert.equal((await request('/api/rooms/join', 'POST', { ...host, questionBank: bankCode })).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', { ...guest, questionBank: bankCode })).status, 200);

  const firstStart = await request('/api/rooms/SWITCH1/start', 'POST', { playerId: host.playerId });
  const firstStartBody = await firstStart.json();
  assert.equal(firstStartBody.questionRevision, activeA.revision);
  assert.equal(firstStartBody.questionBank, bankCode);
  const firstQuestionId = firstStartBody.questionId;

  const secondImport = await request('/api/questions/import', 'POST', {
    bankCode,
    format: 'tsv',
    content: TSV_SAMPLE,
    publish: false,
  });
  const secondImportBody = await secondImport.json();
  assert.equal(secondImport.status, 200);

  const host2 = { roomCode: 'SWITCH2', name: 'Host2', playerId: 'switch-host-2', questionBank: bankCode };
  const guest2 = { roomCode: 'SWITCH2', name: 'Guest2', playerId: 'switch-guest-2', questionBank: bankCode };
  assert.equal((await request('/api/rooms/join', 'POST', host2)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', guest2)).status, 200);

  const pendingStart = await request('/api/rooms/SWITCH2/start', 'POST', { playerId: host2.playerId });
  const pendingBody = await pendingStart.json();
  assert.equal(pendingBody.questionRevision, activeA.revision);
  assert.equal(pendingBody.questionId, firstQuestionId);

  const activatePending = await request('/api/questions/activate', 'POST', {
    bankCode,
    revision: secondImportBody.revision,
  });
  const activated = await activatePending.json();
  assert.equal(activatePending.status, 200);
  assert.equal(activated.status, 'active');
  assert.equal(activated.revision, secondImportBody.revision);

  const host3 = { roomCode: 'SWITCH3', name: 'Host3', playerId: 'switch-host-3', questionBank: bankCode };
  const guest3 = { roomCode: 'SWITCH3', name: 'Guest3', playerId: 'switch-guest-3', questionBank: bankCode };
  assert.equal((await request('/api/rooms/join', 'POST', host3)).status, 200);
  assert.equal((await request('/api/rooms/join', 'POST', guest3)).status, 200);

  const thirdStart = await request('/api/rooms/SWITCH3/start', 'POST', { playerId: host3.playerId });
  const thirdStartBody = await thirdStart.json();
  assert.equal(thirdStartBody.questionRevision, secondImportBody.revision);
  assert.equal(thirdStartBody.questionId, secondImportBody.revision > 0 ? 'QY1' : null);
  assert.notEqual(thirdStartBody.questionId, firstQuestionId);
});
