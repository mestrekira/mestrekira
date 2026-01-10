import { API_URL } from './config.js';

// 🔹 Parâmetros da URL
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// 🔹 Elementos do DOM
const titleEl = document.getElementById('taskTitle');
const guidelinesEl = document.getElementById('taskGuidelines');
const textarea = document.getElementById('essay');
const status = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

if (!textarea || !saveBtn || !sendBtn) {
  console.error('Elementos da redação não encontrados.');
  throw new Error('HTML incompleto');
}

// 🔒 BLOQUEIO DE COLAR TEXTO
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido. A redação deve ser escrita pelo aluno.');
});

// 🔹 Carregar tarefa
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${taskId}`);
    if (!response.ok) throw new Error();

    const task = await response.json();
    titleEl.textContent = task.title;
    guidelinesEl.textContent = task.guidelines || '';

  } catch {
    alert('Erro ao carregar a tarefa.');
  }
}

// 🔹 Salvar rascunho
saveBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_URL}/essays/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId,
        text: textarea.value
      })
    });

    status.textContent = 'Rascunho salvo com sucesso.';

  } catch {
    status.textContent = 'Erro ao salvar rascunho.';
  }
});

// 🔹 Enviar redação definitiva
sendBtn.addEventListener('click', async () => {
  if (textarea.value.length < 500) {
    alert('A redação deve ter no mínimo 500 caracteres.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId,
        text: textarea.value
      })
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Redação enviada para correção.';

    // 🔒 Bloqueia edição após envio
    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});

// 🔹 Inicialização
carregarTarefa();
