import { API_URL } from './config.js';

const textarea = document.getElementById('essay');
const status = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

// BLOQUEIA COLAR TEXTO
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// OBTÉM PARÂMETROS DA URL
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const userId = params.get('userId');

if (!roomId || !userId) {
  alert('Sala ou usuário inválido.');
  throw new Error('Parâmetros ausentes');
}

// SALVAR RASCUNHO
saveBtn.addEventListener('click', async () => {
  const text = textarea.value;

  try {
    const response = await fetch(`${API_URL}/essays/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId, text })
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Rascunho salvo.';
  } catch {
    status.textContent = 'Erro ao salvar rascunho.';
  }
});

// ENVIAR REDAÇÃO DEFINITIVA
sendBtn.addEventListener('click', async () => {
  const text = textarea.value;

  if (text.length < 500) {
    alert('Redação muito curta.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId, text })
    });

    if (!response.ok) throw new Error();

    const data = await response.json(); // ← recebe o essayId

    // BLOQUEIA EDIÇÃO APÓS ENVIO
    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    status.textContent = 'Redação enviada para correção.';

    // REDIRECIONA PARA FEEDBACK
    setTimeout(() => {
      window.location.href = `feedback.html?essayId=${data.essayId}`;
    }, 1000);

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});
