const $ = (selector) => document.querySelector(selector);
const status = $('#status');
const message = $('#message');

function showMessage(text, error = false) {
  message.hidden = false;
  message.textContent = text;
  message.style.color = error ? '#7a1d1d' : '';
}

function renderStatus(data) {
  status.textContent = `Azure Speech: ${data.azureSpeechConfigured ? 'configured' : 'not configured'} (${data.azureSpeechRegion}). OpenAI: ${data.openaiConfigured ? 'configured' : 'not configured'} (${data.openaiModel}).`;
}

async function loadStatus() {
  const response = await fetch('/__dev/status', { cache: 'no-store' });
  if (!response.ok) throw new Error('Local developer settings are unavailable.');
  renderStatus(await response.json());
}

$('#settingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('/__dev/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azureSpeechKey: $('#azureSpeechKey').value, azureSpeechRegion: $('#azureSpeechRegion').value, openaiApiKey: $('#openaiApiKey').value, openaiModel: $('#openaiModel').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to store local settings.');
    $('#azureSpeechKey').value = '';
    $('#openaiApiKey').value = '';
    renderStatus(data);
    showMessage('Keys were accepted into local process memory. The input fields were cleared.');
  } catch (error) { showMessage(error.message, true); }
});

$('#testSpeech').addEventListener('click', async () => {
  try {
    showMessage('Requesting Azure Speech audio...');
    const response = await fetch('/__dev/speech/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: $('#speechText').value }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Azure Speech test failed.'); }
    const audio = new Audio(URL.createObjectURL(await response.blob()));
    await audio.play();
    showMessage('Azure Speech test audio is playing.');
  } catch (error) { showMessage(error.message, true); }
});

loadStatus().catch((error) => showMessage(error.message, true));
