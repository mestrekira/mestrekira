import { API_URL } from './config.js';

// ELEMENTOS
const titleInput = document.getElementById('essayTitle');
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

if (!titleInput || !textarea || !charCount || !status || !sendBtn || !saveBtn) {
  console.error('HTML incompleto em redacao.html');
  throw new Error('Elementos não encontrados');
}

function setStatus(msg) {
  status.textContent = msg || '';
}

function setDisabledAll(disabled) {
  titleInput.disabled = disabled;
  textarea.disabled = disabled;
  saveBtn.disabled = disabled;
  sendBtn.disabled = disabled;
}

function updateCount() {
  charCount.textContent = String((textarea.value || '').length);
}

// ✅ Empacota título + corpo no content (sem mexer no backend de essays)
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

// ✅ BLOQUEAR COLAR / ARRASTAR (inclui fallback p/ mobile)
function antiPaste(el, fieldName, options = {}) {
  if (!el) return;
  const maxJump = Number(options.maxJump ?? 25);
  let lastValue = el.value || '';
  let lastLen = lastValue.length;

  function warn() {
    alert(`Colar texto não é permitido em ${fieldName}. Digite no sistema.`);
  }

  el.addEventListener('paste', (e) => { e.preventDefault(); warn(); });
  el.addEventListener('drop', (e) => { e.preventDefault(); warn(); });
  el.addEventListener('dragover', (e) => e.preventDefault());

  el.addEventListener('beforeinput', (e) => {
    const t = e.inputType;
    if (
      t === 'insertFromPaste' ||
      t === 'insertFromDrop' ||
      t === 'insertFromYank' ||
      t === 'insertReplacementText'
    ) {
      e.preventDefault();
      warn();
    }
  });

  el.addEventListener('input', () => {
    const cur = el.value || '';
    const curLen = cur.length;
    const diff = curLen - lastLen;

    if (diff > maxJump) {
      el.value = lastValue;
      try { el.setSelectionRange(lastLen, lastLen); } catch {}
      warn();
      return;
    }

    lastValue = cur;
    lastLen = curLen;
  });

  function sync() {
    lastValue = el.value || '';
    lastLen = lastValue.length;
  }

  return { sync };
}

const antiTitle = antiPaste(titleInput, 'Título', { maxJump: 15 });
const antiEssay = antiPaste(textarea, 'Redação', { maxJump: 25 });

// ===== BACKEND DRAFTS =====

async function loadDraftServer() {
  const url = `${API_URL}/drafts?taskId=${encodeURIComponent(taskId)}&studentId=${encodeURIComponent(studentId)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return {
    title: String(d?.title || ''),
    content: String(d?.content || ''),
  };
}

async function saveDraftServer(title, content) {
  const res = await fetch(`${API_URL}/drafts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      studentId,
      title: String(title || ''),
      content: String(content || ''),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => null);
}

async function deleteDraftServer() {
  const url = `${API_URL}/drafts?taskId=${encodeURIComponent(taskId)}&studentId=${encodeURIComponent(studentId)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

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

// ✅ CARREGAR RASCUNHO (BACKEND)
async function carregarRascunho() {
  try {
    const draft = await loadDraftServer();
    if (draft && (draft.title.trim() || draft.content.trim())) {
      titleInput.value = draft.title;
      textarea.value = draft.content;
      updateCount();
      setStatus('Rascunho carregado do servidor.');
      antiTitle?.sync?.();
      antiEssay?.sync?.();
      return;
    }
  } catch (err) {
    console.error('Erro ao carregar rascunho:', err);
  }
  updateCount();
}

// AUTOSAVE (BACKEND) com debounce
let autosaveTimer = null;
let autosaveBusy = false;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    const title = (titleInput.value || '').trim();
    const text = textarea.value || '';

    // não salva vazio
    if (!title && !text.trim()) return;

    // evita fila de requests
    if (autosaveBusy) return;
    autosaveBusy = true;

    try {
      await saveDraftServer(title, text);
      // não spammar status
    } catch (err) {
      console.error('Autosave falhou:', err);
      // aqui você pode mostrar um aviso curto se quiser
    } finally {
      autosaveBusy = false;
    }
  }, 700);
}

titleInput.addEventListener('input', () => {
  scheduleAutosave();
});

textarea.addEventListener('input', () => {
  updateCount();
  scheduleAutosave();
});

// ✅ SALVAR RASCUNHO (BACKEND)
saveBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title && !text.trim()) {
    // remove draft no servidor (se existir)
    try {
      await deleteDraftServer();
      setStatus('Nada para salvar. Rascunho removido do servidor.');
    } catch {
      setStatus('Nada para salvar.');
    }
    return;
  }

  try {
    setStatus('Salvando rascunho...');
    await saveDraftServer(title, text);
    setStatus('Rascunho salvo no servidor.');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao salvar rascunho no servidor.');
  }
});

// ✅ VERIFICAR SE JÁ ENVIOU (bloqueia reenvio)
async function checarJaEnviou() {
  try {
    const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(taskId)}`);
    if (!res.ok) return { sent: false };

    const list = await res.json();
    if (!Array.isArray(list)) return { sent: false };

    const mine = list.find((e) => e && String(e.studentId) === String(studentId));

    if (mine && mine.id) return { sent: true, essayId: mine.id };
    return { sent: false };
  } catch {
    return { sent: false };
  }
}

// ✅ ENVIAR REDAÇÃO (BACKEND)
sendBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title) {
    alert('Informe o título da redação.');
    return;
  }

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  sendBtn.disabled = true;

  const ja = await checarJaEnviou();
  if (ja.sent) {
    setStatus('Você já enviou esta redação. Não é permitido reenviar.');
    setDisabledAll(true);
    window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`;
    return;
  }

  setStatus('Enviando redação...');

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId,
        content: packContent(title, text),
      }),
    });

    if (!response.ok) throw new Error();

    const essay = await response.json();

    // ✅ remove o rascunho do servidor após envio
    try { await deleteDraftServer(); } catch {}

    setDisabledAll(true);
    setStatus('Redação enviada com sucesso!');

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 600);
  } catch {
    sendBtn.disabled = false;
    setStatus('Erro ao enviar redação.');
  }
});

// INIT
(async () => {
  await carregarTarefa();

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

  setStatus('Carregando rascunho...');
  await carregarRascunho();
  setStatus('');
})();
