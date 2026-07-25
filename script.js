const sampleQuestions = [
  { question: 'Who said, “I am the resurrection and the life”?', expected_answer: 'Jesus', accepted_answers: 'Jesus; the Lord Jesus; Christ', reference: 'John 11:25', explanation: 'Jesus spoke these words to Martha.' },
  { question: 'To whom did Jesus say, “I am the resurrection and the life”?', expected_answer: 'Martha', accepted_answers: 'Martha; to Martha', reference: 'John 11:25', explanation: 'Jesus said this to Martha before raising Lazarus.' },
  { question: 'Who baptized Jesus?', expected_answer: 'John the Baptist', accepted_answers: 'John; John Baptist; John the Baptizer', reference: 'Matthew 3:13–17', explanation: 'John the Baptist baptized Jesus in the Jordan River.' },
  { question: 'What was the name of the man Jesus raised from the dead in John 11?', expected_answer: 'Lazarus', accepted_answers: 'Lazarus', reference: 'John 11:43–44', explanation: 'Jesus called Lazarus out of the tomb.' },
  { question: 'On what day did God rest after creation?', expected_answer: 'The seventh day', accepted_answers: 'seventh day; day seven; the 7th day', reference: 'Genesis 2:2–3', explanation: 'God rested and blessed the seventh day.' },
  { question: 'Who built an ark at God’s command?', expected_answer: 'Noah', accepted_answers: 'Noah', reference: 'Genesis 6:14–22', explanation: 'Noah built the ark as God instructed.' },
  { question: 'What city was Jesus born in?', expected_answer: 'Bethlehem', accepted_answers: 'Bethlehem', reference: 'Matthew 2:1', explanation: 'Jesus was born in Bethlehem of Judea.' }
];

const state = { questions: [...sampleQuestions], index: 0, phase: 'ready', shownWords: 0, timer: null, fullyRead: false };
const $ = (selector) => document.querySelector(selector);
const startBtn = $('#startBtn'), buzzBtn = $('#buzzBtn'), nextBtn = $('#nextBtn'), questionText = $('#questionText');
const answerArea = $('#answerArea'), answerInput = $('#answerInput'), rulingArea = $('#rulingArea');
const readingState = $('#readingState'), aiStatus = $('#aiStatus'), bankStatus = $('#bankStatus');

function current() { return state.questions[state.index]; }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function updateQuestionNumber() { $('#questionNumber').textContent = `Question ${state.index + 1} of ${state.questions.length}`; }
function startQuestion() {
  clearInterval(state.timer); state.phase = 'reading'; state.shownWords = 0; state.fullyRead = false;
  answerArea.hidden = true; rulingArea.hidden = true; startBtn.disabled = true; buzzBtn.disabled = false; nextBtn.disabled = true;
  updateQuestionNumber(); questionText.textContent = ''; readingState.textContent = 'Question is being read — press Space to buzz in.';
  const words = current().question.split(/\s+/);
  state.timer = setInterval(() => {
    state.shownWords += 1; questionText.textContent = words.slice(0, state.shownWords).join(' ');
    if (state.shownWords >= words.length) { clearInterval(state.timer); state.fullyRead = true; readingState.textContent = 'Question complete — answer when ready.'; }
  }, 150);
}
function buzzIn() {
  if (state.phase !== 'reading') return;
  clearInterval(state.timer); state.phase = 'answering'; buzzBtn.disabled = true;
  readingState.textContent = state.fullyRead ? 'You may answer now.' : 'Buzz registered. The question has stopped.';
  answerArea.hidden = false; answerInput.value = ''; answerInput.focus();
}
async function submitAnswer() {
  const answer = answerInput.value.trim(); if (!answer || state.phase !== 'answering') return;
  state.phase = 'judging'; $('#submitBtn').disabled = true; readingState.textContent = 'Checking your answer…';
  try {
    const response = await fetch('/api/judge', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ question:current(), answer }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The AI judge could not be reached.');
    showRuling(result);
  } catch (error) {
    showRuling({ verdict:'needs_review', explanation:`${error.message} Please compare your answer with the expected answer.`, source:'unavailable' });
  } finally { $('#submitBtn').disabled = false; }
}
function showRuling(result) {
  state.phase = 'ruled'; answerArea.hidden = true; rulingArea.hidden = false; nextBtn.disabled = false; readingState.textContent = 'Answer recorded.';
  const display = { correct:'Correct', incorrect:'Incorrect', needs_review:'Needs review' };
  const rulingClass = ['correct','incorrect','needs_review'].includes(result.verdict) ? result.verdict.replace('_',' ') : 'needs review';
  rulingArea.className = `ruling-area ${rulingClass === 'needs review' ? 'review' : rulingClass}`;
  $('#rulingTitle').textContent = display[result.verdict] || 'Needs review';
  $('#rulingExplanation').textContent = result.explanation;
  $('#expectedAnswer').textContent = current().expected_answer; $('#reference').textContent = current().reference; $('#explanation').textContent = current().explanation;
}
function nextQuestion() { state.index = (state.index + 1) % state.questions.length; startBtn.disabled = false; startQuestion(); }
function normalizeHeader(header) { return header.toLowerCase().trim().replace(/[\s-]+/g, '_'); }
function parseDelimited(text) {
  const delimiter = text.includes('\t') ? '\t' : ','; const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('Include a header row and at least one question.');
  const split = (line) => { const values=[]; let value='', quoted=false; for (let i=0;i<line.length;i++){ const char=line[i]; if(char==='"'){ if(quoted && line[i+1]==='"'){ value+='"'; i++; } else quoted=!quoted; } else if(char===delimiter && !quoted){ values.push(value.trim()); value=''; } else value+=char; } values.push(value.trim()); return values; };
  const headers = split(lines[0]).map(normalizeHeader); const required = ['question','expected_answer','accepted_answers','reference','explanation'];
  const missing = required.filter(name => !headers.includes(name)); if (missing.length) throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
  return lines.slice(1).map((line, lineIndex) => { const values=split(line); const row=Object.fromEntries(headers.map((header,index)=>[header,values[index] || ''])); if(required.some(name=>!row[name])) throw new Error(`Row ${lineIndex + 2} has an empty required field.`); return row; });
}
$('#importFile').addEventListener('change', async event => { const file=event.target.files[0]; if(!file) return; try { const questions=parseDelimited(await file.text()); state.questions=questions; state.index=0; bankStatus.textContent=`${questions.length} imported question${questions.length===1?'':'s'} ready`; startBtn.disabled=false; updateQuestionNumber(); } catch(error) { bankStatus.textContent=`Import not used: ${error.message}`; } finally { event.target.value=''; } });
$('#downloadTemplateBtn').addEventListener('click', () => { const csv='question,expected_answer,accepted_answers,reference,explanation\n"Who said this?",Jesus,"Jesus; the Lord Jesus",John 11:25,"Jesus spoke these words."\n'; const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); link.download='quizbiblo-question-template.csv'; link.click(); URL.revokeObjectURL(link.href); });
startBtn.addEventListener('click', startQuestion); buzzBtn.addEventListener('click', buzzIn); nextBtn.addEventListener('click', nextQuestion); $('#submitBtn').addEventListener('click', submitAnswer);
answerInput.addEventListener('keydown', event => { if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); submitAnswer(); } });
document.addEventListener('keydown', event => { if(event.code==='Space' && state.phase==='reading' && document.activeElement !== answerInput){ event.preventDefault(); buzzIn(); } });
fetch('/api/health').then(response=>response.json()).then(data=>{ aiStatus.textContent=data.aiConfigured?'AI judge connected':'AI key not set — exact matches only'; aiStatus.className=`ai-status ${data.aiConfigured?'online':'offline'}`; }).catch(()=>{ aiStatus.textContent='Server connection unavailable'; aiStatus.className='ai-status offline'; });
updateQuestionNumber();
