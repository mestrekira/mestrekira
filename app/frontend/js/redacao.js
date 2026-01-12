import { API_URL } from './config.js';

const textarea = document.getElementById('essay');
const status = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Dados inválidos.');
  throw new Error('taskId ou studentId ausente');
}

// 🔒 BLOQUEAR COLAR
textarea.addEventListener('paste', e => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// 🔹 SALVAR RASCUNHO (localStorage)
saveBtn.addEventListener('click', () => {
  localStorage.setItem(`draft-${taskId}`, textarea.value);
  status.textContent = 'Rascunho salvo.';
});

// 🔹 ENVIAR REDAÇÃO
sendBtn.addEventListener('click', async () => {
  const content = textarea.value.trim();

  if (content.length < 500) {
    alert('A redação deve ter no mínimo 500 caracteres.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content }),
    });

    window.location.href = `feedback-aluno.html?essayId=${data.id}`;

    if (!response.ok) throw new Error();

    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    status.textContent = 'Redação enviada com sucesso.';

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});

