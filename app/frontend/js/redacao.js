import { API_URL } from './config.js';

const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');

const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

const taskTitleEl = document.getElementById('taskTitle');
const taskGuidelinesEl = document.getElementById('taskGuidelines');

const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

let currentEssayId = null;
let alreadySubmitted = false;

if (!taskId || !studentId || studentId === 'undefined' || studentId === 'null') {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

function setStatus(msg) {
  status.textContent = msg || '';
}

textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

textarea.addEventListener('input', () => {
  charCount.textContent = String(textarea.value.length);
});

async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) throw new Error();

    const task = await response.json();
    taskTitleEl.textContent = task.title || 'Tema da Redação';
    taskGuidelinesEl.textContent = task.guidelines || 'Sem orientações adicionais.';
  } catch {
    taskTitleEl.textContent = 'Tema da Redação';
    taskGuidelinesEl.textContent = 'Não foi possível carregar as orientações.';
  }
}

async function carregarMinhaRedacaoOuRascunho() {
  try {
    const res = await fetch(
      `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student?studentId=${encodeURIComponent(studentId)}`
    );

    if (!res.ok) return; // se não existir, ok

    const essay = await res.json();
    if (!essay) return;

    currentEssayId = essay.id || null;

    textarea.value = essay.content || '';
    charCount.textContent = String(textarea.value.length);

    // ✅ se já foi enviada, bloqueia e oferece ver feedback
    if (essay.isDraft === false) {
      alreadySubmitted = true;
      textarea.disabled = true;
      saveBtn.disabled = true;
      sendBtn.textContent = 'Ver feedback';
      setStatus('Você já enviou esta redação.');

      sendBtn.onclick = () => {
        window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
      };
    }
  } catch {
    // ignora (sem travar a página)
  }
}

// SALVAR RASCUNHO
saveBtn.addEventListener('click', async () => {
  if (alreadySubmitted) return;

  const text = textarea.value;

  if (!text.trim()) {
    setStatus('Nada para salvar.');
    return;
  }

  setStatus('Salvando rascunho...');

  try {
    const response = await fetch(`${API_URL}/essays/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text }),
    });

    if (!response.ok) throw new Error();

    const saved = await response.json();
    currentEssayId = saved?.id || currentEssayId;

    setStatus('Rascunho salvo com sucesso.');
  } catch {
    setStatus('Erro ao salvar rascunho.');
  }
});

// ENVIAR
sendBtn.addEventListener('click', async () => {
  if (alreadySubmitted) return;

  const text = textarea.value;

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  setStatus('Enviando redação...');

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text }),
    });

    if (!response.ok) {
      // 409 => já enviou
      if (response.status === 409) {
        setStatus('Você já enviou esta redação. Abrindo feedback...');
        const existing = await fetch(
          `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student?studentId=${encodeURIComponent(studentId)}`
        );
        if (existing.ok) {
          const e = await existing.json();
          if (e?.id) {
            window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(e.id)}`;
            return;
          }
        }
      }
      throw new Error();
    }

    const essay = await response.json();

    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    setStatus('Redação enviada com sucesso!');

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 600);
  } catch {
    setStatus('Erro ao enviar redação.');
  }
});

// INIT
carregarTarefa();
carregarMinhaRedacaoOuRascunho();
