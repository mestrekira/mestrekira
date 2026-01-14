import { API_URL } from './config.js';

// ELEMENTOS
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');

const taskTitleEl = document.getElementById('taskTitle');
const taskGuidelinesEl = document.getElementById('taskGuidelines');

// PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// BLOQUEAR COLAR
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// CONTADOR
textarea.addEventListener('input', () => {
  charCount.textContent = textarea.value.length;
});

// 🔹 CARREGAR TAREFA (TEMA + ORIENTAÇÕES)
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${taskId}`);
    if (!response.ok) throw new Error();

    const task = await response.json();
    taskTitleEl.textContent = task.title || 'Tema da Redação';
    taskGuidelinesEl.textContent = task.guidelines || 'Sem orientações adicionais.';

  } catch {
    taskTitleEl.textContent = 'Tema da Redação';
    taskGuidelinesEl.textContent = 'Não foi possível carregar as orientações.';
  }
}

// ENVIAR
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
    sendBtn.disabled = true;
    status.textContent = 'Redação enviada com sucesso!';

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${essay.id}`;
    }, 800);

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});

carregarTarefa();
