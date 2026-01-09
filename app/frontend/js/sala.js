import { API_URL } from './config.js';

// 🔹 Elementos do DOM (com proteção)
const textarea = document.getElementById('essay');
const status = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

if (!textarea || !status || !saveBtn || !sendBtn) {
  console.error('Elementos do editor não encontrados no HTML.');
  throw new Error('Editor incompleto.');
}

// 🔹 Bloqueia colar texto
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// 🔹 Parâmetros da URL
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId) {
  alert('Tarefa ou usuário inválido.');
  throw new Error('Parâmetros ausentes');
}

// 🔹 Salvar rascunho
saveBtn.addEventListener('click', async () => {
  const content = textarea.value;

  try {
    const response = await fetch(`${API_URL}/essays/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content }),
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Rascunho salvo.';
  } catch {
    status.textContent = 'Erro ao salvar rascunho.';
  }
});

// 🔹 Enviar redação definitiva
sendBtn.addEventListener('click', async () => {
  const content = textarea.value;

  if (content.length < 500) {
    alert('Redação muito curta.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content }),
    });

    if (!response.ok) throw new Error();

    const data = await response.json(); // { essayId }

    // 🔒 Bloqueia edição após envio
    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    status.textContent = 'Redação enviada para correção.';

    // 🔁 Redireciona para feedback
    setTimeout(() => {
      window.location.href = `feedback.html?essayId=${data.essayId}`;
    }, 1000);

  } catch {
    status.textContent = 'Erro ao enviar redação.';
  }
});
