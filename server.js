const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3101);
const root = __dirname;
const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

function send(response, status, body, type='application/json; charset=utf-8') { response.writeHead(status, { 'Content-Type':type, 'Cache-Control':'no-store' }); response.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body)); }
function normalise(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function localJudge(question, answer) {
  const alternatives = [question.expected_answer, ...(question.accepted_answers || '').split(';')].map(normalise).filter(Boolean);
  const received = normalise(answer);
  const match = alternatives.some(option => received === option || received.includes(option));
  return match
    ? { verdict:'correct', explanation:'Your answer matches an approved answer. Configure OPENAI_API_KEY to evaluate broader conversational paraphrases.', source:'exact_match' }
    : { verdict:'needs_review', explanation:'AI is not configured, so this answer cannot be judged by meaning. Compare it with the expected answer below.', source:'unavailable' };
}
async function aiJudge(question, answer) {
  const prompt = `You judge one short factual Bible-practice answer. Use only the approved material below. Do not use outside knowledge. A natural paraphrase is correct when it communicates the same required fact. If it is incomplete, ambiguous, or you are not confident, return needs_review. Never invent missing facts. Return JSON only with verdict (correct, incorrect, or needs_review) and a concise explanation for the learner.\n\nQuestion: ${question.question}\nExpected answer: ${question.expected_answer}\nApproved alternatives: ${question.accepted_answers || 'None'}\nReference: ${question.reference}\nExplanation: ${question.explanation}\nLearner answer: ${answer}`;
  const apiResponse = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:'gpt-5.6-terra', input:prompt, reasoning:{ effort:'low' }, text:{ verbosity:'low' } }) });
  const data = await apiResponse.json();
  if (!apiResponse.ok) throw new Error(data.error?.message || 'The AI service returned an error.');
  const text = data.output_text || data.output?.flatMap(item => item.content || []).map(item => item.text || '').join('') || '';
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
  if (!['correct','incorrect','needs_review'].includes(json.verdict) || typeof json.explanation !== 'string') throw new Error('The AI judge returned an invalid ruling.');
  return { verdict:json.verdict, explanation:json.explanation, source:'ai' };
}
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { aiConfigured });
  if (request.method === 'POST' && url.pathname === '/api/judge') {
    let body=''; request.on('data', chunk => { body += chunk; if(body.length > 100000) request.destroy(); });
    request.on('end', async () => { try { const { question, answer } = JSON.parse(body); if (!question?.question || !question?.expected_answer || !String(answer || '').trim()) return send(response, 400, { error:'A question and answer are required.' }); const result=aiConfigured ? await aiJudge(question, String(answer).trim()) : localJudge(question, answer); send(response,200,result); } catch(error) { send(response,502,{ error:error.message || 'Unable to judge this answer.' }); } });
    return;
  }
  if (request.method !== 'GET') return send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root)) return send(response,403,'Forbidden','text/plain; charset=utf-8');
  fs.readFile(file, (error, data) => error ? send(response,404,'Not found','text/plain; charset=utf-8') : send(response,200,data,contentTypes[path.extname(file)] || 'application/octet-stream'));
});
server.listen(port, () => console.log(`QuizBiblo running at http://localhost:${port}`));
