import { API_URL } from './config.js';

// 🔹 ELEMENTOS
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// 🔹 BLOQUEAR COLAR TEXTO
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// 🔹 CONTADOR DE CARACTERES
textarea.addEventListener('input', () => {
  charCount.textContent = textarea.value.length;
});

// 🔹 SALVAR RASCUNHO
saveBtn.addEventListener('click', async () => {
  const text = textarea.value;

  if (!text) {
    status.textContent = 'Nada para salvar.';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text })
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Rascunho salvo com sucesso.';
  } catch {
    status.textContent = 'Erro ao salvar rascunho.';
  }
});

// 🔹 ENVIAR REDAÇÃO DEFINITIVA
sendBtn.addEventListener('click', async () => {
  const text = textarea.value;

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text })
    });

    if (!response.ok) throw new Error();

    const essay = await response.json();

    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    status.textContent = 'Redação enviada com sucesso!';

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${essay.id}`;
    }, 1000);

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});
