import { API_URL } from './config.js';

// ELEMENTOS
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');

const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

const taskTitleEl = document.getElementById('taskTitle');
const taskGuidelinesEl = document.getElementById('taskGuidelines');

// PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId || studentId === 'undefined' || studentId === 'null') {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

if (!textarea || !charCount || !status || !sendBtn || !saveBtn) {
  console.error('HTML incompleto em redacao.html');
  throw new Error('Elementos não encontrados');
}

// ✅ RASCUNHO via localStorage (gratuito, sem backend)
function draftKey() {
  return `mk_draft_${studentId}_${taskId}`;
}

function loadDraft() {
  const data = localStorage.getItem(draftKey());
  if (!data) return false;

  try {
    const obj = JSON.parse(data);
    if (obj && typeof obj.text === 'string') {
      textarea.value = obj.text;
      charCount.textContent = String(obj.text.length);
      status.textContent = obj.savedAt
        ? `Rascunho recuperado (${new Date(obj.savedAt).toLocaleString()}).`
        : 'Rascunho recuperado.';
      return true;
    }
  } catch {
    // se tiver lixo salvo, ignora
  }
  return false;
}

function saveDraft() {
  const text = textarea.value || '';
  const payload = {
    text,
    savedAt: Date.now(),
  };
  localStorage.setItem(draftKey(), JSON.stringify(payload));
}

// ✅ BLOQUEAR COLAR
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// CONTADOR + autosave leve
let autosaveTimer = null;
textarea.addEventListener('input', () => {
  charCount.textContent = String(textarea.value.length);

  // autosave a cada ~800ms enquanto digita (não atrapalha)
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if ((textarea.value || '').trim().length > 0) {
      saveDraft();
    }
  }, 800);
});

// 🔹 CARREGAR TAREFA (TEMA + ORIENTAÇÕES)
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

// ✅ Verifica se já existe redação enviada (pra bloquear UI antes)
async function checarSeJaEnviou() {
  try {
    const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(taskId)}`);
    if (!res.ok) return null;

    const essays = await res.json();
    if (!Array.isArray(essays)) return null;

    const mine = essays.find((e) => e && e.studentId === studentId);
    return mine || null;
  } catch {
    return null;
  }
}

function bloquearEnvio(msg) {
  textarea.disabled = true;
  saveBtn.disabled = true;
  sendBtn.disabled = true;
  status.textContent = msg;
}

// ✅ SALVAR RASCUNHO (botão)
saveBtn.addEventListener('click', () => {
  const text = textarea.value || '';

  if (!text.trim()) {
    status.textContent = 'Nada para salvar.';
    return;
  }

  saveDraft();
  status.textContent = 'Rascunho salvo neste navegador.';
});

// ✅ ENVIAR REDAÇÃO
sendBtn.addEventListener('click', async () => {
  const text = textarea.value || '';

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  status.textContent = 'Enviando redação...';
  sendBtn.disabled = true;

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text }),
    });

    // ✅ se backend bloquear duplicado, mostra mensagem boa
    if (!response.ok) {
      const msg = await response.text().catch(() => '');
      sendBtn.disabled = false;

      // tenta deixar amigável
      if (String(msg).toLowerCase().includes('já enviou')) {
        status.textContent = 'Você já enviou esta redação. Não é possível enviar duas vezes.';
        // opcional: você pode redirecionar para desempenho/feedback se achar melhor
        return;
      }

      throw new Error();
    }

    const essay = await response.json();

    // remove rascunho após enviar
    localStorage.removeItem(draftKey());

    textarea.disabled = true;
    saveBtn.disabled = true;
    sendBtn.disabled = true;

    status.textContent = 'Redação enviada com sucesso!';

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 800);
  } catch {
    status.textContent = 'Erro ao enviar redação.';
    sendBtn.disabled = false;
  }
});

// INIT
(async () => {
  await carregarTarefa();

  // 1) tenta recuperar rascunho
  loadDraft();

  // 2) checa se já enviou
  const existing = await checarSeJaEnviou();
  if (existing?.id) {
    bloquearEnvio('Você já enviou esta redação. Aguarde a correção do professor.');
  }
})();
