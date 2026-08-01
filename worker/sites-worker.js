const textEncoder = new TextEncoder();
const ROOM_TTL_MS = 30 * 60 * 1000;
const POLL_MS = 700;
const IMPORT_MAX_BYTES = 200 * 1024;
const MAX_FIELD_LENGTH = 600;
const MAX_ARRAY_ITEM_LENGTH = 200;
const MAX_ANSWERS_PER_QUESTION = 20;
const DEFAULT_QUESTION_BANK = 'default';
const SUPPORTED_QUESTION_TYPES = new Set(['regular', 'interrogative']);

const SAMPLE_QUESTION_BANK = [
  {
    questionId: 'Q-100',
    questionType: 'regular',
    officialQuestion: 'What color is the sky on a clear day?',
    spokenQuestion: 'What color is the sky on a clear day?',
    expectedAnswer: 'blue',
    acceptedAnswers: ['blue', 'azure', 'sky blue'],
    reference: 'https://example.org/quiz-demo/sky-color',
    explanation: 'The clear daytime sky is mostly blue because of Rayleigh scattering.',
    introRemarks: 'Keep the delivery calm and loud enough for both players.',
    interruptionRequirements: 'Do not interrupt while the question is speaking.',
    pronunciationHints: 'Blue, as in blue.',
  },
  {
    questionId: 'Q-101',
    questionType: 'interrogative',
    officialQuestion: 'Who is the first person on the moon in this game?',
    spokenQuestion: 'Who was the first person on the moon in this game context?',
    expectedAnswer: 'Neil Armstrong',
    acceptedAnswers: ['Neil Armstrong', 'Armstrong', 'moonwalker'],
    reference: 'https://example.org/quiz-demo/moon',
    explanation: 'This game uses sample trivia for demonstration only.',
    introRemarks: 'Read the question exactly as written.',
    interruptionRequirements: 'Do not interrupt until the question is fully spoken.',
    pronunciationHints: 'Neil like "Neal", Armstrong with emphasis on first syllable.',
  },
];

const rooms = new Map();
const questionBanks = new Map();
const assets = new Map([
  ['/', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/index.html', { body: __INDEX_HTML__, type: 'text/html; charset=utf-8' }],
  ['/styles.css', { body: __STYLES_CSS__, type: 'text/css; charset=utf-8' }],
  ['/script.js', { body: __SCRIPT_JS__, type: 'text/javascript; charset=utf-8' }],
]);

let d1Initialized = false;
let questionSchemaInitialized = false;

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

function safeQuestionBank(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || DEFAULT_QUESTION_BANK;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasUnsafeMarkup(value) {
  return /<[^>]*>/.test(String(value || ''));
}

function containsUnsupportedField(field) {
  return hasUnsafeMarkup(field);
}

function isEmpty(value) {
  return !String(value || '').trim();
}

function nowRowError(rowNumber, field, message) {
  return { row: rowNumber, field, message };
}

function parseDelimitedRows(raw, delimiter) {
  const text = String(raw ?? '');
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let unbalancedQuotes = false;

  const flushField = () => {
    row.push(cell);
    cell = '';
  };
  const flushRow = () => {
    if (row.length > 1 || row[0] !== '' || cell !== '') {
      rows.push(row);
      row = [];
    } else {
      row = [];
    }
  };

  for (let i = 0; i <= normalized.length; i += 1) {
    const char = i === normalized.length ? '\n' : normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      flushField();
    } else if (char === '\n') {
      flushField();
      flushRow();
    } else {
      cell += char;
    }
  }

  if (inQuotes) unbalancedQuotes = true;
  return { rows, unbalancedQuotes };
}

const QUESTION_FIELD_ALIASES = new Map([
  ['question_id', 'questionId'],
  ['questionid', 'questionId'],
  ['type', 'questionType'],
  ['question_type', 'questionType'],
  ['official_question', 'officialQuestion'],
  ['officialquestion', 'officialQuestion'],
  ['spoken_question', 'spokenQuestion'],
  ['spokenquestion', 'spokenQuestion'],
  ['expected_answer', 'expectedAnswer'],
  ['expectedanswer', 'expectedAnswer'],
  ['accepted_answers', 'acceptedAnswers'],
  ['acceptedanswers', 'acceptedAnswers'],
  ['reference', 'reference'],
  ['explanation', 'explanation'],
  ['intro_remarks', 'introRemarks'],
  ['introremarks', 'introRemarks'],
  ['interruption_requirements', 'interruptionRequirements'],
  ['interruptionrequirements', 'interruptionRequirements'],
  ['pronunciation_hints', 'pronunciationHints'],
  ['pronunciationhints', 'pronunciationHints'],
]);

function normalizeFieldName(field) {
  return String(field || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseAcceptedAnswers(raw, rowNumber, errors) {
  const source = String(raw || '').trim();
  const normalizeAnswer = (answer) => normalizeText(answer).replace(/^"|"$/g, '');
  if (!source) {
    errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'accepted answers are required'));
    return [];
  }

  let values = [];
  if (source.startsWith('[') && source.endsWith(']')) {
    try {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed) || !parsed.length) {
        errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'accepted answers must be a non-empty list'));
      } else {
        values = parsed.map((item) => String(item).trim());
      }
    } catch {
      errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'accepted answers JSON is invalid'));
    }
  } else {
    const delimiter = source.includes('|') ? '|' : source.includes(';') ? ';' : ',';
    values = source
      .split(delimiter)
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (!values.length) {
      errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'accepted answers are required'));
    }
  }

  const normalized = values
    .map((answer) => normalizeAnswer(answer))
    .filter(Boolean);

  if (normalized.length !== values.length) {
    values = values.filter((answer) => String(answer).trim() !== '');
  }

  if (normalized.length > MAX_ANSWERS_PER_QUESTION) {
    errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'too many accepted answers'));
  }

  const outOfRange = values.some((answer) => String(answer).length > MAX_ARRAY_ITEM_LENGTH || hasUnsafeMarkup(answer));
  if (outOfRange) {
    errors.push(nowRowError(rowNumber, 'acceptedAnswers', 'accepted answers are malformed'));
  }

  const deduped = [];
  const seen = new Set();
  for (const answer of normalized) {
    if (!seen.has(answer)) {
      seen.add(answer);
      deduped.push(answer);
    }
  }
  return deduped;
}

function validateQuestionRecord(row, rowNumber, seenIds, errors, fieldIndex) {
  const id = String(row[fieldIndex.questionId] || '').trim();
  const type = String(row[fieldIndex.questionType] || '').trim().toLowerCase();
  const officialQuestion = String(row[fieldIndex.officialQuestion] || '').trim();
  const spokenQuestion = String(row[fieldIndex.spokenQuestion] || '').trim();
  const expectedAnswer = String(row[fieldIndex.expectedAnswer] || '').trim();
  const acceptedAnswers = parseAcceptedAnswers(row[fieldIndex.acceptedAnswers], rowNumber, errors);
  const reference = String(row[fieldIndex.reference] || '').trim();
  const explanation = String(row[fieldIndex.explanation] || '').trim();
  const introRemarks = String(row[fieldIndex.introRemarks] || '').trim();
  const interruptionRequirements = String(row[fieldIndex.interruptionRequirements] || '').trim();
  const pronunciationHints = String(row[fieldIndex.pronunciationHints] || '').trim();

  if (!id) errors.push(nowRowError(rowNumber, 'questionId', 'question id is required'));
  if (!type) errors.push(nowRowError(rowNumber, 'questionType', 'question type is required'));
  if (type && !SUPPORTED_QUESTION_TYPES.has(type)) {
    errors.push(nowRowError(rowNumber, 'questionType', 'unsupported question type'));
  }
  if (isEmpty(officialQuestion)) errors.push(nowRowError(rowNumber, 'officialQuestion', 'official question is required'));
  if (isEmpty(spokenQuestion)) errors.push(nowRowError(rowNumber, 'spokenQuestion', 'spoken question is required'));
  if (isEmpty(expectedAnswer)) errors.push(nowRowError(rowNumber, 'expectedAnswer', 'expected answer is required'));
  if (isEmpty(reference)) errors.push(nowRowError(rowNumber, 'reference', 'reference is required'));
  if (isEmpty(explanation)) errors.push(nowRowError(rowNumber, 'explanation', 'explanation is required'));
  if (isEmpty(introRemarks)) errors.push(nowRowError(rowNumber, 'introRemarks', 'intro remarks are required'));
  if (isEmpty(interruptionRequirements)) {
    errors.push(nowRowError(rowNumber, 'interruptionRequirements', 'interruption requirements are required'));
  }
  if (isEmpty(pronunciationHints)) errors.push(nowRowError(rowNumber, 'pronunciationHints', 'pronunciation hints are required'));

  if (containsUnsupportedField(id)) errors.push(nowRowError(rowNumber, 'questionId', 'question id contains unsupported markup'));
  if (containsUnsupportedField(type)) errors.push(nowRowError(rowNumber, 'questionType', 'question type contains unsupported markup'));
  if (hasUnsafeMarkup(officialQuestion)) {
    errors.push(nowRowError(rowNumber, 'officialQuestion', 'official question contains unsupported markup'));
  }
  if (hasUnsafeMarkup(spokenQuestion)) errors.push(nowRowError(rowNumber, 'spokenQuestion', 'spoken question contains unsupported markup'));
  if (hasUnsafeMarkup(expectedAnswer)) errors.push(nowRowError(rowNumber, 'expectedAnswer', 'expected answer contains unsupported markup'));
  if (hasUnsafeMarkup(reference)) errors.push(nowRowError(rowNumber, 'reference', 'reference contains unsupported markup'));
  if (hasUnsafeMarkup(explanation)) errors.push(nowRowError(rowNumber, 'explanation', 'explanation contains unsupported markup'));
  if (hasUnsafeMarkup(introRemarks)) errors.push(nowRowError(rowNumber, 'introRemarks', 'intro remarks contain unsupported markup'));
  if (hasUnsafeMarkup(interruptionRequirements)) {
    errors.push(nowRowError(rowNumber, 'interruptionRequirements', 'interruption requirements contain unsupported markup'));
  }
  if (hasUnsafeMarkup(pronunciationHints)) errors.push(nowRowError(rowNumber, 'pronunciationHints', 'pronunciation hints contain unsupported markup'));

  if (officialQuestion.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'officialQuestion', 'official question is too long'));
  }
  if (spokenQuestion.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'spokenQuestion', 'spoken question is too long'));
  }
  if (expectedAnswer.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'expectedAnswer', 'expected answer is too long'));
  }
  if (reference.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'reference', 'reference is too long'));
  }
  if (explanation.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'explanation', 'explanation is too long'));
  }
  if (introRemarks.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'introRemarks', 'intro remarks are too long'));
  }
  if (interruptionRequirements.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'interruptionRequirements', 'interruption requirements are too long'));
  }
  if (pronunciationHints.length > MAX_FIELD_LENGTH) {
    errors.push(nowRowError(rowNumber, 'pronunciationHints', 'pronunciation hints are too long'));
  }

  if (!isEmpty(expectedAnswer) && acceptedAnswers.length) {
    const normalizedExpected = normalizeText(expectedAnswer);
    if (!acceptedAnswers.includes(normalizedExpected)) {
      errors.push(nowRowError(
        rowNumber,
        'acceptedAnswers',
        'expected answer must match at least one accepted answer',
      ));
    }
  }

  if (id && seenIds.has(id)) {
    errors.push(nowRowError(rowNumber, 'questionId', 'duplicate question id'));
  } else if (id) {
    seenIds.add(id);
  }

  return {
    questionId: id,
    questionType: type,
    officialQuestion,
    spokenQuestion,
    expectedAnswer,
    acceptedAnswers,
    reference,
    explanation,
    introRemarks,
    interruptionRequirements,
    pronunciationHints,
  };
}

function parseQuestionBankInput(raw) {
  const content = String(raw.content || '');
  const format = String(raw.format || 'csv').toLowerCase();
  const delimiter = format === 'tsv' ? '\t' : ',';
  const errors = [];
  const parsed = [];

  if (!content.trim()) errors.push({ row: 1, field: 'content', message: 'content is required' });
  if (!Number.isFinite(content.length) || content.length > IMPORT_MAX_BYTES) {
    errors.push({ row: 1, field: 'content', message: 'file is too large' });
  }
  if (!['csv', 'tsv'].includes(format)) {
    errors.push({ row: 1, field: 'format', message: 'format must be csv or tsv' });
  }

  if (errors.length) {
    return { format, errors, records: [] };
  }

  const parsedResult = parseDelimitedRows(content, delimiter);
  if (parsedResult.unbalancedQuotes) {
    errors.push({ row: 1, field: 'content', message: 'malformed quoted text' });
  }

  const lines = parsedResult.rows;
  if (lines.length < 2) {
    errors.push({ row: 1, field: 'content', message: 'header row and at least one data row are required' });
    return { format, errors, records: [] };
  }

  const header = lines[0].map(normalizeFieldName).map((name) => QUESTION_FIELD_ALIASES.get(name) || name);
  const fieldIndex = {};
  for (const canonical of [
    'questionId', 'questionType', 'officialQuestion', 'spokenQuestion', 'expectedAnswer', 'acceptedAnswers', 'reference', 'explanation', 'introRemarks', 'interruptionRequirements', 'pronunciationHints',
  ]) {
    const index = header.findIndex((value) => value === canonical);
    if (index >= 0) fieldIndex[canonical] = index;
  }

  for (const required of ['questionId', 'questionType', 'officialQuestion', 'spokenQuestion', 'expectedAnswer', 'acceptedAnswers', 'reference', 'explanation', 'introRemarks', 'interruptionRequirements', 'pronunciationHints']) {
    if (typeof fieldIndex[required] !== 'number') {
      errors.push({ row: 1, field: required, message: `missing required field: ${required}` });
    }
  }
  if (errors.length) return { format, errors, records: [] };

  const seenIds = new Set();
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const row = lines[rowIndex];
    const isEmptyLine = row.every((value) => String(value || '').trim() === '');
    if (isEmptyLine) continue;
    const rowNumber = rowIndex + 1;
    parsed.push(validateQuestionRecord(row, rowNumber, seenIds, errors, fieldIndex));
  }

  return { format, errors, records: parsed };
}

function snapshot(room) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    players: room.players.map(({ id, name }) => ({ id, name })),
    state: room.state,
    questionNumber: room.questionIndex < 0 ? 0 : room.questionIndex + 1,
    questionBank: room.questionBank || DEFAULT_QUESTION_BANK,
    questionRevision: room.questionRevision || 0,
    question: room.question || null,
    questionId: room.questionId || null,
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

function toQuestionItem(record) {
  return {
    question_id: record.questionId,
    question_type: record.questionType,
    official_question: record.officialQuestion,
    spoken_question: record.spokenQuestion,
    expected_answer: record.expectedAnswer,
    accepted_answers_json: JSON.stringify(record.acceptedAnswers),
    reference: record.reference,
    explanation: record.explanation,
    intro_remarks: record.introRemarks,
    interruption_requirements: record.interruptionRequirements,
    pronunciation_hints: record.pronunciationHints,
  };
}

function normalizeRoom(rawRoom) {
  if (!rawRoom) return null;
  return {
    code: rawRoom.room_code,
    hostId: rawRoom.host_id,
    state: rawRoom.state,
    players: parsePlayers(rawRoom.players_json),
    questionIndex: toSafeInt(rawRoom.question_index, -1),
    attemptId: toSafeInt(rawRoom.attempt_id, 0),
    sequence: toSafeInt(rawRoom.sequence, 0),
    winnerId: rawRoom.winner_id || null,
    questionStartedAt: rawRoom.question_started_at ? Number(rawRoom.question_started_at) : null,
    questionBank: rawRoom.question_bank || DEFAULT_QUESTION_BANK,
    questionRevision: toSafeInt(rawRoom.question_revision, 0),
    question: rawRoom.question || null,
    questionId: rawRoom.question_id || null,
    expiresAt: toSafeInt(rawRoom.expires_at, now()),
  };
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
    questionId: roomSnapshot.questionId,
    questionBank: roomSnapshot.questionBank,
    questionRevision: roomSnapshot.questionRevision,
  };
}

function ensureMemoryQuestionBank(bankCode) {
  const bank = safeQuestionBank(bankCode);
  if (!questionBanks.has(bank)) {
    const bankState = {
      bankCode: bank,
      activeRevision: 0,
      nextRevision: 1,
      revisions: new Map(),
    };
    if (bank === DEFAULT_QUESTION_BANK) {
      bankState.revisions.set(1, {
        revision: 1,
        status: 'active',
        createdAt: now(),
        questions: SAMPLE_QUESTION_BANK.map((question) => ({ ...question })),
      });
      bankState.activeRevision = 1;
      bankState.nextRevision = 2;
    }
    questionBanks.set(bank, bankState);
  }
  return questionBanks.get(bank);
}

function questionsForMemoryRevision(bankCode, revision) {
  const bank = ensureMemoryQuestionBank(bankCode);
  return bank.revisions.get(revision)?.questions || [];
}

function questionRevisionForNewMemory(bankCode) {
  const bank = ensureMemoryQuestionBank(bankCode);
  const revision = bank.nextRevision;
  bank.nextRevision += 1;
  return revision;
}

function importQuestionRevisionMemory(bankCode, parsed, publish) {
  const bank = ensureMemoryQuestionBank(bankCode);
  const revision = questionRevisionForNewMemory(bankCode);
  bank.revisions.set(revision, {
    revision,
    status: publish ? 'active' : 'pending',
    createdAt: now(),
    questions: parsed.map((record) => ({ ...record })),
  });
  if (publish) bank.activeRevision = revision;
  return {
    bankCode,
    revision,
    status: publish ? 'active' : 'pending',
    questionCount: parsed.length,
    activeRevision: publish ? revision : bank.activeRevision,
  };
}

function activateQuestionRevisionMemory(bankCode, revision) {
  const bank = ensureMemoryQuestionBank(bankCode);
  if (!bank.revisions.has(revision)) {
    const error = new Error('Revision not found.');
    error.code = 404;
    throw error;
  }
  bank.activeRevision = revision;
  for (const entry of bank.revisions.values()) {
    entry.status = entry.revision === revision ? 'active' : 'pending';
  }
  return {
    bankCode,
    revision,
    status: 'active',
  };
}

function normalizeQuestionRevision(rawRevision) {
  if (!rawRevision) return null;
  return {
    bankCode: rawRevision.bank_code,
    revision: toSafeInt(rawRevision.revision, 0),
    status: rawRevision.status,
    createdAt: toSafeInt(rawRevision.created_at, now()),
  };
}

function normalizeQuestionItem(rawQuestion) {
  if (!rawQuestion) return null;
  let acceptedAnswers = [];
  try {
    const parsed = JSON.parse(rawQuestion.accepted_answers_json || '[]');
    acceptedAnswers = Array.isArray(parsed) ? parsed : [];
  } catch {
    acceptedAnswers = [];
  }
  return {
    questionId: rawQuestion.question_id,
    questionType: rawQuestion.question_type,
    officialQuestion: rawQuestion.official_question,
    spokenQuestion: rawQuestion.spoken_question,
    expectedAnswer: rawQuestion.expected_answer,
    acceptedAnswers,
    reference: rawQuestion.reference,
    explanation: rawQuestion.explanation,
    introRemarks: rawQuestion.intro_remarks,
    interruptionRequirements: rawQuestion.interruption_requirements,
    pronunciationHints: rawQuestion.pronunciation_hints,
  };
}

function createRoomSnapshot(code, hostId, name, questionBank = DEFAULT_QUESTION_BANK, questionRevision = 0) {
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
    questionBank,
    questionRevision,
    question: null,
    questionId: null,
    expiresAt: now() + ROOM_TTL_MS,
  };
}

function roomFromPath(pathname) {
  const match = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/|$)/);
  return match ? match[1] : null;
}

function emitSnapshot(controller, room) {
  return emit(controller, 'snapshot', snapshot(room));
}

function ensureMemoryRoomDefaults(code, hostId, name, questionBank = DEFAULT_QUESTION_BANK, questionRevision = 0) {
  if (!rooms.has(code)) {
    const resolvedBank = safeQuestionBank(questionBank);
    const resolvedRevision = questionRevision || getActiveMemoryRevision(resolvedBank);
    rooms.set(code, createRoomSnapshot(code, hostId, name, resolvedBank, resolvedRevision));
  }
  const room = rooms.get(code);
  if (room.questionBank && room.questionBank !== safeQuestionBank(questionBank)) {
    const error = new Error('Room bank mismatch.');
    error.code = 409;
    throw error;
  }
  room.expiresAt = now() + ROOM_TTL_MS;
  return room;
}

function getActiveMemoryRevision(bankCode) {
  const bank = ensureMemoryQuestionBank(bankCode);
  return bank.activeRevision || 0;
}

function getAttemptableQuestionsFromMemory(room) {
  return questionsForMemoryRevision(room.questionBank || DEFAULT_QUESTION_BANK, room.questionRevision || getActiveMemoryRevision(room.questionBank || DEFAULT_QUESTION_BANK));
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
      question_bank TEXT NOT NULL,
      question_revision INTEGER NOT NULL,
      question TEXT,
      question_id TEXT,
      expires_at INTEGER NOT NULL,
      players_json TEXT NOT NULL
    )`,
  ).run();

  const roomColumns = await env.DB.prepare('PRAGMA table_info(rooms)').all();
  const existingColumns = new Set((roomColumns.results || []).map((row) => String(row.name)));
  if (!existingColumns.has('question_bank')) {
    await env.DB.prepare('ALTER TABLE rooms ADD COLUMN question_bank TEXT NOT NULL DEFAULT "' + DEFAULT_QUESTION_BANK + '"').run();
  }
  if (!existingColumns.has('question_revision')) {
    await env.DB.prepare('ALTER TABLE rooms ADD COLUMN question_revision INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!existingColumns.has('question')) {
    await env.DB.prepare('ALTER TABLE rooms ADD COLUMN question TEXT').run();
  }
  if (!existingColumns.has('question_id')) {
    await env.DB.prepare('ALTER TABLE rooms ADD COLUMN question_id TEXT').run();
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS question_banks (
      bank_code TEXT PRIMARY KEY,
      active_revision INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS question_revisions (
      bank_code TEXT NOT NULL,
      revision INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      question_count INTEGER NOT NULL,
      row_count INTEGER NOT NULL,
      created_by TEXT DEFAULT 'system',
      PRIMARY KEY (bank_code, revision)
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS question_items (
      bank_code TEXT NOT NULL,
      revision INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      official_question TEXT NOT NULL,
      spoken_question TEXT NOT NULL,
      expected_answer TEXT NOT NULL,
      accepted_answers_json TEXT NOT NULL,
      reference TEXT NOT NULL,
      explanation TEXT NOT NULL,
      intro_remarks TEXT NOT NULL,
      interruption_requirements TEXT NOT NULL,
      pronunciation_hints TEXT NOT NULL,
      PRIMARY KEY (bank_code, revision, question_id)
    )`,
  ).run();

  d1Initialized = true;
  questionSchemaInitialized = true;
  await seedDefaultQuestionBankD1(env);
}

async function ensureQuestionBank(env, bankCode) {
  await env.DB.prepare(
    `INSERT INTO question_banks (bank_code, active_revision, updated_at)
       VALUES (?, 0, ?)
       ON CONFLICT(bank_code) DO UPDATE SET updated_at = excluded.updated_at`,
  ).bind(bankCode, now()).run();
  const { results } = await env.DB.prepare('SELECT active_revision FROM question_banks WHERE bank_code = ?').bind(bankCode).all();
  return { bankCode, activeRevision: toSafeInt(results?.[0]?.active_revision, 0) };
}

async function seedDefaultQuestionBankD1(env) {
  const bankCode = DEFAULT_QUESTION_BANK;
  await ensureQuestionBank(env, bankCode);
  const { results } = await env.DB.prepare('SELECT revision FROM question_revisions WHERE bank_code = ?').bind(bankCode).all();
  if (results && results.length > 0) return;

  const insertedRevision = 1;
  await env.DB.prepare(
    `INSERT INTO question_revisions (
      bank_code, revision, status, created_at, question_count, row_count
    ) VALUES (?, ?, 'active', ?, ?, ?)`,
  ).bind(
    bankCode,
    insertedRevision,
    now(),
    SAMPLE_QUESTION_BANK.length,
    SAMPLE_QUESTION_BANK.length,
  ).run();

  for (const record of SAMPLE_QUESTION_BANK) {
    const normalized = toQuestionItem(record);
    await env.DB.prepare(
      `INSERT INTO question_items (
        bank_code, revision, question_id, question_type, official_question, spoken_question,
        expected_answer, accepted_answers_json, reference, explanation, intro_remarks,
        interruption_requirements, pronunciation_hints
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      bankCode,
      insertedRevision,
      normalized.question_id,
      normalized.question_type,
      normalized.official_question,
      normalized.spoken_question,
      normalized.expected_answer,
      normalized.accepted_answers_json,
      normalized.reference,
      normalized.explanation,
      normalized.intro_remarks,
      normalized.interruption_requirements,
      normalized.pronunciation_hints,
    ).run();
  }
  await env.DB.prepare('UPDATE question_banks SET active_revision = ?, updated_at = ? WHERE bank_code = ?').bind(insertedRevision, now(), bankCode).run();
}

async function getQuestionRevisionRows(env, bankCode) {
  const rows = await env.DB.prepare('SELECT revision FROM question_revisions WHERE bank_code = ? ORDER BY revision DESC').bind(bankCode).all();
  return rows.results || [];
}

async function getActiveQuestionRevisionD1(env, bankCode) {
  const normalizedBank = safeQuestionBank(bankCode);
  const bank = await getQuestionBankD1(env, normalizedBank);
  if (bank && bank.activeRevision > 0) return bank.activeRevision;
  const revisions = await getQuestionRevisionRows(env, normalizedBank);
  if (revisions.length === 0) return 0;
  return toSafeInt(revisions[0].revision, 0);
}

async function getQuestionBankD1(env, bankCode) {
  const normalizedBank = safeQuestionBank(bankCode);
  const { results } = await env.DB.prepare('SELECT bank_code, active_revision, updated_at FROM question_banks WHERE bank_code = ?').bind(normalizedBank).all();
  const raw = results?.[0];
  if (!raw) return null;
  return { bankCode: raw.bank_code, activeRevision: toSafeInt(raw.active_revision, 0), updatedAt: raw.updated_at };
}

async function loadQuestionItemsD1(env, bankCode, revision) {
  const { results } = await env.DB.prepare(
    `SELECT question_id, question_type, official_question, spoken_question, expected_answer,
            accepted_answers_json, reference, explanation, intro_remarks, interruption_requirements, pronunciation_hints
       FROM question_items
      WHERE bank_code = ? AND revision = ?
   ORDER BY question_id`,
  ).bind(bankCode, revision).all();

  return (results || []).map(normalizeQuestionItem);
}

async function importQuestionRevisionD1(env, bankCode, records, publish = false) {
  const normalizedBank = safeQuestionBank(bankCode);
  await initD1(env);
  await ensureQuestionBank(env, normalizedBank);
  const revisionRows = await getQuestionRevisionRows(env, normalizedBank);
  const revision = revisionRows.length ? toSafeInt(revisionRows[0].revision, 0) + 1 : 1;

  await env.DB.prepare(
    `INSERT INTO question_revisions (bank_code, revision, status, created_at, question_count, row_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(normalizedBank, revision, publish ? 'active' : 'pending', now(), records.length, records.length).run();

  for (const record of records) {
    const normalized = toQuestionItem(record);
    await env.DB.prepare(
      `INSERT INTO question_items (
        bank_code, revision, question_id, question_type, official_question, spoken_question,
        expected_answer, accepted_answers_json, reference, explanation, intro_remarks,
        interruption_requirements, pronunciation_hints
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      normalizedBank,
      revision,
      normalized.question_id,
      normalized.question_type,
      normalized.official_question,
      normalized.spoken_question,
      normalized.expected_answer,
      normalized.accepted_answers_json,
      normalized.reference,
      normalized.explanation,
      normalized.intro_remarks,
      normalized.interruption_requirements,
      normalized.pronunciation_hints,
    ).run();
  }

  if (publish) {
    await env.DB.prepare('UPDATE question_revisions SET status = CASE WHEN revision = ? THEN "active" ELSE "pending" END WHERE bank_code = ?')
      .bind(revision, normalizedBank).run();
    await env.DB.prepare('UPDATE question_banks SET active_revision = ?, updated_at = ? WHERE bank_code = ?')
      .bind(revision, now(), normalizedBank).run();
  }

  return {
    bankCode: normalizedBank,
    revision,
    status: publish ? 'active' : 'pending',
    questionCount: records.length,
    activeRevision: publish ? revision : await getActiveQuestionRevisionD1(env, normalizedBank),
  };
}

async function activateQuestionRevisionD1(env, bankCode, revision) {
  const normalizedBank = safeQuestionBank(bankCode);
  const { results } = await env.DB.prepare('SELECT revision, status FROM question_revisions WHERE bank_code = ? AND revision = ?').bind(normalizedBank, revision).all();
  if (!results || results.length === 0) {
    const error = new Error('Revision not found.');
    error.code = 404;
    throw error;
  }
  await env.DB.prepare('UPDATE question_revisions SET status = CASE WHEN revision = ? THEN "active" ELSE "pending" END WHERE bank_code = ?').bind(revision, normalizedBank).run();
  await env.DB.prepare('UPDATE question_banks SET active_revision = ?, updated_at = ? WHERE bank_code = ?').bind(revision, now(), normalizedBank).run();
  return { bankCode: normalizedBank, revision, status: 'active' };
}

async function getActiveQuestionCatalogD1(env, bankCode, revision) {
  const normalizedBank = safeQuestionBank(bankCode);
  const resolvedRevision = revision || (await getActiveQuestionRevisionD1(env, normalizedBank));
  if (!resolvedRevision) return [];
  return loadQuestionItemsD1(env, normalizedBank, resolvedRevision);
}

function cleanExpiredMemory() {
  const cutoff = now();
  for (const [code, room] of rooms.entries()) {
    if (room.expiresAt < cutoff) rooms.delete(code);
  }
}

function cleanupD1(env) {
  return env.DB.prepare('DELETE FROM rooms WHERE expires_at < ?').bind(now()).run();
}

async function findRoomD1(env, code) {
  const { results } = await env.DB.prepare(
    `SELECT room_code, host_id, state, question_index, attempt_id, sequence,
            winner_id, question_started_at, question_bank, question_revision, question, question_id, expires_at, players_json
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
      winner_id, question_started_at, question_bank, question_revision, question, question_id, expires_at, players_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_code) DO UPDATE SET
       host_id = COALESCE(rooms.host_id, excluded.host_id),
       state = excluded.state,
       question_index = excluded.question_index,
       attempt_id = excluded.attempt_id,
       sequence = excluded.sequence,
       winner_id = excluded.winner_id,
       question_started_at = excluded.question_started_at,
       question_bank = excluded.question_bank,
       question_revision = excluded.question_revision,
       question = excluded.question,
       question_id = excluded.question_id,
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
    room.questionBank || DEFAULT_QUESTION_BANK,
    room.questionRevision || 0,
    room.question,
    room.questionId,
    room.expiresAt,
    JSON.stringify(room.players),
  ).run();
}

function bumpSequence(room) {
  room.sequence += 1;
  room.expiresAt = now() + ROOM_TTL_MS;
}

async function ensureRoomD1(env, code, playerId, name, requestedBank) {
  await initD1(env);
  await cleanupD1(env);
  const resolvedBank = safeQuestionBank(requestedBank || DEFAULT_QUESTION_BANK);
  const activeRevision = await getActiveQuestionRevisionD1(env, resolvedBank);

  const placeholderPlayers = JSON.stringify([{ id: playerId, name }]);
  await env.DB.prepare(
    `INSERT INTO rooms (
      room_code, host_id, state, question_index, attempt_id, sequence,
      winner_id, question_started_at, question_bank, question_revision, question, question_id, expires_at, players_json
    ) VALUES (?, ?, 'waiting', -1, 0, 0, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`,
  ).bind(code, playerId, resolvedBank, activeRevision, now() + ROOM_TTL_MS, placeholderPlayers).run().catch((error) => {
    if (!error || !String(error.message).includes('UNIQUE')) {
      throw error;
    }
  });

  const room = await findRoomD1(env, code);
  if (!room) return null;
  if (room.questionBank && room.questionBank !== resolvedBank) {
    const mismatch = new Error('This room is already using another question bank.');
    mismatch.code = 409;
    throw mismatch;
  }

  const currentIndex = room.players.findIndex((entry) => entry.id === playerId);
  if (currentIndex >= 0) {
    if (room.players[currentIndex].name !== name) {
      room.players[currentIndex].name = name;
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
  room.questionBank = resolvedBank;
  room.questionRevision = room.questionRevision || activeRevision;
  await upsertRoomD1(env, room);
  return room;
}

async function ensureRoomMemory(code, playerId, name, requestedBank) {
  cleanExpiredMemory();
  const resolvedBank = safeQuestionBank(requestedBank || DEFAULT_QUESTION_BANK);
  const room = ensureMemoryRoomDefaults(code, playerId, name, resolvedBank, getActiveMemoryRevision(resolvedBank));

  const existing = room.players.find((entry) => entry.id === playerId);
  if (existing) {
    if (existing.name !== name) {
      existing.name = name;
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

function pickQuestionForAttempt(questionSet, questionIndex) {
  const nextQuestionIndex = (questionIndex + 1) % questionSet.length;
  const candidate = questionSet[nextQuestionIndex];
  return { candidate, nextQuestionIndex };
}

async function startAttemptD1(env, room, playerId) {
  requireHost(room, playerId);
  if (room.players.length < 2) {
    const err = new Error('Wait for a second player to join.');
    err.code = 409;
    throw err;
  }
  if (room.state === 'reading' || room.state === 'locked') return room;

  const selectedBank = room.questionBank || DEFAULT_QUESTION_BANK;
  const activeRevision = room.questionRevision || await getActiveQuestionRevisionD1(env, selectedBank);
  const questionSet = await getActiveQuestionCatalogD1(env, selectedBank, activeRevision);
  if (!questionSet.length) {
    const err = new Error('No active approved questions are available for this bank.');
    err.code = 409;
    throw err;
  }

  const startAt = now();
  const { candidate, nextQuestionIndex } = pickQuestionForAttempt(questionSet, room.questionIndex);
  const updated = await env.DB.prepare(
    `UPDATE rooms
        SET state = 'reading',
            question_index = ?,
            attempt_id = attempt_id + 1,
            sequence = sequence + 1,
            winner_id = NULL,
            question_started_at = ?,
            question_bank = ?,
            question_revision = ?,
            question = ?,
            question_id = ?,
            expires_at = ?
      WHERE room_code = ?
        AND state IN ('waiting', 'locked')`,
  ).bind(nextQuestionIndex, startAt, selectedBank, activeRevision, candidate.officialQuestion, candidate.questionId, startAt + ROOM_TTL_MS, room.code).run();
  if (updated.meta?.changes !== 1) return (await loadRoomState(env, room.code)) || room;
  const latest = await findRoomD1(env, room.code);
  if (latest) return latest;
  return room;
}

function startAttemptMemory(room, playerId) {
  requireHost(room, playerId);
  if (room.players.length < 2) {
    const err = new Error('Wait for a second player to join.');
    err.code = 409;
    throw err;
  }
  if (room.state === 'reading' || room.state === 'locked') return room;

  const questionSet = getAttemptableQuestionsFromMemory(room);
  if (!questionSet.length) {
    const err = new Error('No active approved questions are available for this bank.');
    err.code = 409;
    throw err;
  }
  const { candidate, nextQuestionIndex } = pickQuestionForAttempt(questionSet, room.questionIndex);
  room.questionIndex = nextQuestionIndex;
  room.state = 'reading';
  room.winnerId = null;
  room.attemptId += 1;
  room.questionStartedAt = now();
  room.question = candidate.officialQuestion;
  room.questionId = candidate.questionId;
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
        if (closed) return null;
        try {
          const room = await loadRoomState(env, code);
          if (!room) {
            emit(controller, 'error', { error: 'Room no longer exists.' });
            controller.close();
            return null;
          }
          if (!room.players.some((entry) => entry.id === playerId)) {
            emit(controller, 'error', { error: 'Join the room first.' });
            controller.close();
            return null;
          }
          emitSnapshot(controller, room);
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

function normalizeQuestionImportInput(input) {
  const bankCode = safeQuestionBank(input.bankCode || DEFAULT_QUESTION_BANK);
  const format = String(input.format || 'csv').toLowerCase();
  const content = String(input.content || '');
  const publish = Boolean(input.publish);
  return { bankCode, format, content, publish };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function speechSsml(text, voice = 'en-US-JennyNeural', rate = '0%') {
  return `<speak version="1.0" xml:lang="en-US"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(text)}</prosody></voice></speak>`;
}

function speechTextForQuestion(question) {
  return question.spokenQuestion || question.officialQuestion || '';
}

async function getApprovedQuestionForSpeech(env, room, questionId) {
  const requestedId = String(questionId || room.questionId || '').trim();
  if (!requestedId || requestedId !== String(room.questionId || '').trim()) return null;
  if (hasD1(env)) {
    const questions = await getActiveQuestionCatalogD1(env, room.questionBank, room.questionRevision);
    return questions.find((question) => question.questionId === requestedId) || null;
  }
  const questions = questionsForMemoryRevision(room.questionBank, room.questionRevision);
  return questions.find((question) => question.questionId === requestedId) || null;
}

async function speechApi(input, env) {
  const key = String(env.AZURE_SPEECH_KEY || '').trim();
  const region = String(env.AZURE_SPEECH_REGION || 'eastus').trim().toLowerCase();
  if (!key) return json({ error: 'Speech is not configured.' }, 503);
  const roomCode = cleanCode(input.roomCode);
  const playerId = safePlayerId(input.playerId);
  if (!roomCode || !playerId) return json({ error: 'A current room and player are required.' }, 400);

  const room = await loadRoomState(env, roomCode);
  if (!room || !room.players.some((player) => player.id === playerId)) return json({ error: 'Join the room first.' }, 403);
  const question = await getApprovedQuestionForSpeech(env, room, input.questionId);
  if (!question) return json({ error: 'Only the current approved question may be synthesized.' }, 404);

  const voice = 'en-US-JennyNeural';
  const text = speechTextForQuestion(question);
  if (!text || text.length > MAX_FIELD_LENGTH) return json({ error: 'The approved speech text is invalid.' }, 400);
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'QuizBiblo/0.1.7',
      },
      body: speechSsml(text, voice),
    });
  } catch {
    return json({ error: 'Speech service is temporarily unavailable.' }, 503);
  }
  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 503;
    return json({ error: status === 429 ? 'Speech quota is busy. Try again shortly.' : 'Speech service could not prepare audio.' }, status);
  }
  const audio = await response.arrayBuffer();
  if (!audio.byteLength) return json({ error: 'Speech service returned empty audio.' }, 502);
  return new Response(audio, {
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'private, max-age=300',
      'x-quizbiblo-question-id': question.questionId,
      'x-quizbiblo-question-revision': String(room.questionRevision || 0),
      'x-quizbiblo-attempt-id': String(room.attemptId || 0),
    },
  });
}

function questionsApiPreview(input) {
  const parsed = parseQuestionBankInput(input);
  return json({
    ok: parsed.errors.length === 0,
    bankCode: input.bankCode || DEFAULT_QUESTION_BANK,
    format: parsed.format,
    rowCount: parsed.records.length,
    errorCount: parsed.errors.length,
    errors: parsed.errors,
    preview: parsed.records.slice(0, 3),
  }, parsed.errors.length ? 400 : 200);
}

async function questionsApiImport(input, env) {
  const { bankCode, format, content, publish } = normalizeQuestionImportInput(input);
  const parsed = parseQuestionBankInput({ bankCode, format, content });
  if (parsed.errors.length) {
    return json({
      ok: false,
      bankCode,
      revision: null,
      errorCount: parsed.errors.length,
      errors: parsed.errors,
    }, 400);
  }

  if (hasD1(env)) {
    const imported = await importQuestionRevisionD1(env, bankCode, parsed.records, publish);
    return json({ ok: true, ...imported });
  }

  const imported = importQuestionRevisionMemory(bankCode, parsed.records, publish);
  return json({ ok: true, ...imported });
}

async function questionsApiActivate(input, env) {
  const bankCode = safeQuestionBank(input.bankCode || DEFAULT_QUESTION_BANK);
  const revision = toSafeInt(input.revision, 0);
  if (!revision) {
    return json({ error: 'revision is required.' }, 400);
  }
  if (hasD1(env)) {
    try {
      const activated = await activateQuestionRevisionD1(env, bankCode, revision);
      return json({ ok: true, ...activated });
    } catch (error) {
      return json({ error: error.message }, error.code || 500);
    }
  }
  try {
    const activated = activateQuestionRevisionMemory(bankCode, revision);
    return json({ ok: true, ...activated });
  } catch (error) {
    return json({ error: error.message }, error.code || 500);
  }
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

  if (request.method === 'POST' && url.pathname === '/api/questions/preview') {
    const input = await request.json();
    return questionsApiPreview({
      bankCode: input.bankCode,
      format: input.format || 'csv',
      content: input.content || '',
    });
  }
  if (request.method === 'POST' && url.pathname === '/api/questions/import') {
    const input = await request.json();
    return questionsApiImport(input, env);
  }
  if (request.method === 'POST' && url.pathname === '/api/questions/activate') {
    const input = await request.json();
    return questionsApiActivate(input, env);
  }
  if (request.method === 'POST' && url.pathname === '/api/speech/synthesize') {
    const input = await request.json();
    return speechApi(input, env);
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
    try {
      const input = await request.json();
      const code = cleanCode(input.roomCode);
      const name = safeName(input.name);
      const playerId = safePlayerId(input.playerId);
      const questionBank = safeQuestionBank(input.questionBank);
      if (!code || !name || !playerId) return json({ error: 'Room code and display name are required.' }, 400);

      if (hasD1(env)) {
        try {
          const room = await ensureRoomD1(env, code, playerId, name, questionBank);
          if (!room) return json({ error: 'Unable to join room.' }, 500);
          return json(snapshot(room));
        } catch (error) {
          return json({ error: error.message || 'Unable to join room.' }, error.code || 400);
        }
      }
      try {
        const room = await ensureRoomMemory(code, playerId, name, questionBank);
        return json(snapshot(room));
      } catch (error) {
        return json({ error: error.message || 'Unable to join room.' }, error.code || 400);
      }
    } catch (error) {
      return json({ error: error.message || 'Invalid request.' }, 400);
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
        return json(buildRoomStateResponse(latest || started));
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
