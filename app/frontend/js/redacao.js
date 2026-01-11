import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');

const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Dados inválidos.');
  window.location.href = 'painel-aluno.html';
}

// 🔹 ELEMENTOS
const titleEl = document.getElementById('taskTitle');
const guidelinesEl = document.getElementById('taskGuidelines');
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const sendBtn = document.getElementById('sendBtn');
const statusEl = document.getElementById('status');

// 🔒 BLOQUEAR COLAR TEXTO
textarea.addEventListener('paste', e => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// 🔢 CONTADOR DE CARACTERES
textarea.addEventListener('input', () => {
  charCount.textContent = textarea.value.length;
});

// 🔹 CARREGAR TAREFA
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${taskId}`);
    if (!response.ok) throw new Error();

    const task = await response.json();

    titleEl.textContent = task.title;
    guidelinesEl.textContent = task.guidelines || '—';

  } catch {
    alert('Erro ao carregar tarefa.');
    window.location.href = 'painel-aluno.html';
  }
}

// 🔹 ENVIAR REDAÇÃO
sendBtn.addEventListener('click', async () => {
  const content = textarea.value.trim();

  if (content.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId,
        content,
      }),
    });

    if (!response.ok) throw new Error();

    const essay = await response.json();

    textarea.disabled = true;
    sendBtn.disabled = true;

    statusEl.textContent = 'Redação enviada com sucesso.';

    setTimeout(() => {
      window.location.href = `feedback.html?essayId=${essay.id}`;
    }, 1200);

  } catch {
    statusEl.textContent = 'Erro ao enviar redação.';
  }
});

// 🔹 INIT
carregarTarefa();
