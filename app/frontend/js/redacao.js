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

function setStatus(msg) {
  status.textContent = msg || '';
}

function setDisabledAll(disabled) {
  textarea.disabled = disabled;
  saveBtn.disabled = disabled;
  sendBtn.disabled = disabled;
}

function draftKey() {
  return `mk_draft_${studentId}_${taskId}`;
}

function updateCount() {
  charCount.textContent = String(textarea.value.length);
}

// BLOQUEAR COLAR
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// CONTADOR + AUTOSAVE (leve)
let autosaveTimer = null;
textarea.addEventListener('input', () => {
  updateCount();

  // autosave com debounce
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const text = textarea.value || '';
    // salva mesmo vazio? aqui salva só se tiver algo
    if (text.trim()) {
      localStorage.setItem(draftKey(), text);
      // sem spammar status
    }
  }, 600);
});

// 🔹 CARREGAR TAREFA (TEMA + ORIENTAÇÕES)
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) throw new Error();

    const task = await response.json();
    taskTitleEl.textContent = task?.title || 'Tema da Redação';
    taskGuidelinesEl.textContent = task?.guidelines || 'Sem orientações adicionais.';
  } catch {
    taskTitleEl.textContent = 'Tema da Redação';
    taskGuidelinesEl.textContent = 'Não foi possível carregar as orientações.';
  }
}

// ✅ CARREGAR RASCUNHO LOCAL (SE EXISTIR)
function carregarRascunhoLocal() {
  const saved = localStorage.getItem(draftKey());
  if (saved && saved.trim()) {
    textarea.value = saved;
    updateCount();
    setStatus('Rascunho carregado.');
  } else {
    updateCount();
  }
}

// ✅ SALVAR RASCUNHO (LOCALSTORAGE)
saveBtn.addEventListener('click', () => {
  const text = textarea.value || '';

  if (!text.trim()) {
    // se estava salvo antes e o aluno apagou, remove o draft
    localStorage.removeItem(draftKey());
    setStatus('Nada para salvar. Rascunho removido.');
    return;
  }

  localStorage.setItem(draftKey(), text);
  setStatus('Rascunho salvo.');
});

// ✅ VERIFICAR SE JÁ ENVIOU (bloqueia reenvio)
async function checarJaEnviou() {
  try {
    const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(taskId)}`);
    if (!res.ok) return { sent: false };

    const list = await res.json();
    if (!Array.isArray(list)) return { sent: false };

    const mine = list.find((e) => e && e.studentId === studentId);

    if (mine && mine.id) {
      return { sent: true, essayId: mine.id };
    }

    return { sent: false };
  } catch {
    // se der erro, não bloqueia (só evita travar o aluno)
    return { sent: false };
  }
}

// ✅ ENVIAR REDAÇÃO (BACKEND)
sendBtn.addEventListener('click', async () => {
  const text = textarea.value || '';

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  // evita clique duplo
  sendBtn.disabled = true;

  // checa de novo antes de enviar (segurança)
  const ja = await checarJaEnviou();
  if (ja.sent) {
    setStatus('Você já enviou esta redação. Não é permitido reenviar.');
    setDisabledAll(true);
    // leva direto pro feedback já enviado
    window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`;
    return;
  }

  setStatus('Enviando redação...');

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, studentId, content: text }),
    });

    if (!response.ok) throw new Error();

    const essay = await response.json();

    // remove rascunho após envio bem sucedido
    localStorage.removeItem(draftKey());

    setDisabledAll(true);
    setStatus('Redação enviada com sucesso!');

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 600);
  } catch {
    // reabilita envio em caso de erro
    sendBtn.disabled = false;
    setStatus('Erro ao enviar redação.');
  }
});

// INIT
(async () => {
  await carregarTarefa();

  // primeiro tenta carregar rascunho local
  carregarRascunhoLocal();

  // depois checa se já existe envio (se existir, bloqueia e manda pro feedback)
  setStatus('Verificando envio...');
  const ja = await checarJaEnviou();

  if (ja.sent) {
    setStatus('Você já enviou esta redação. Redirecionando para o feedback...');
    setDisabledAll(true);

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`;
    }, 400);

    return;
  }

  setStatus('');
})();
