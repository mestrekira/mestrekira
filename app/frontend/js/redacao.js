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

// ===============================
// LOCAL DRAFT (fallback)
// ===============================
function draftKey() {
  return `mk_draft_${studentId}_${taskId}`;
}

function saveDraftLocal(title, content) {
  const payload = { title: title || '', content: content || '', updatedAt: Date.now() };
  localStorage.setItem(draftKey(), JSON.stringify(payload));
}

function loadDraftLocal() {
  const raw = localStorage.getItem(draftKey());
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw);
    if (!obj) return null;
    return {
      title: String(obj.title || ''),
      content: String(obj.content || ''),
      updatedAt: Number(obj.updatedAt || 0) || 0,
    };
  } catch {
    return null;
  }
}

function clearDraftLocal() {
  localStorage.removeItem(draftKey());
}

// ===============================
// REMOTE DRAFT (backend)
// ===============================
// GET /drafts?taskId=...&studentId=...
async function fetchDraftRemote() {
  const url =
    `${API_URL}/drafts?taskId=${encodeURIComponent(taskId)}` +
    `&studentId=${encodeURIComponent(studentId)}`;

  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Draft GET HTTP ${res.status}`);

  const data = await res.json().catch(() => null);
  if (!data) return null;

  return {
    title: String(data.title || ''),
    content: String(data.content || ''),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : 0,
  };
}

// PUT /drafts { taskId, studentId, title, content }
async function saveDraftRemote(title, content) {
  const res = await fetch(`${API_URL}/drafts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      studentId,
      title: title || '',
      content: content || '',
    }),
  });

  if (!res.ok) throw new Error(`Draft PUT HTTP ${res.status}`);

  const data = await res.json().catch(() => null);
  return data || true;
}

// (opcional) DELETE /drafts?taskId=...&studentId=...
async function deleteDraftRemote() {
  const url =
    `${API_URL}/drafts?taskId=${encodeURIComponent(taskId)}` +
    `&studentId=${encodeURIComponent(studentId)}`;

  const res = await fetch(url, { method: 'DELETE' });
  // se não existir, ok
  if (res.status === 404) return true;
  if (!res.ok) throw new Error(`Draft DELETE HTTP ${res.status}`);
  return true;
}

// ===============================
// CONTENT PACK (título + corpo)
// ===============================
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

// ===============================
// ANTI-PASTE (mobile + desktop)
// ===============================
function antiPaste(el, fieldName, options = {}) {
  if (!el) return;

  const maxJump = Number(options.maxJump ?? 25);
  let lastValue = el.value || '';
  let lastLen = lastValue.length;

  function warn() {
    alert(`Colar texto não é permitido em ${fieldName}. Digite no sistema.`);
  }

  el.addEventListener('paste', (e) => {
    e.preventDefault();
    warn();
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    warn();
  });

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
      try {
        el.setSelectionRange(lastLen, lastLen);
      } catch {}
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

// ===============================
// AUTOSAVE (backend first; local fallback)
// ===============================
let autosaveTimer = null;
let isSaving = false;
let lastSavedHash = '';

function makeHash(title, content) {
  // hash simples (evita salvar o mesmo conteúdo toda hora)
  const t = String(title || '');
  const c = String(content || '');
  return `${t.length}:${c.length}:${t.slice(0, 20)}:${c.slice(0, 20)}`;
}

async function autosaveNow({ silent = true } = {}) {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  // não salva vazio
  if (!title && !text.trim()) return;

  const hash = makeHash(title, text);
  if (hash === lastSavedHash) return;

  if (isSaving) return;
  isSaving = true;

  try {
    await saveDraftRemote(title, text);
    lastSavedHash = hash;

    // também guarda local como backup (opcional, mas aumenta resiliência)
    saveDraftLocal(title, text);

    if (!silent) setStatus('Rascunho salvo no servidor.');
  } catch (err) {
    // fallback local
    saveDraftLocal(title, text);
    if (!silent) setStatus('Rascunho salvo localmente (sem conexão com o servidor).');
  } finally {
    isSaving = false;
  }
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => autosaveNow({ silent: true }), 700);
}

titleInput.addEventListener('input', () => {
  scheduleAutosave();
});

textarea.addEventListener('input', () => {
  updateCount();
  scheduleAutosave();
});

// ===============================
// CARREGAR TAREFA (tema/orientações)
// ===============================
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

// ===============================
// CARREGAR RASCUNHO (remote com fallback local)
// ===============================
async function carregarRascunho() {
  // 1) tenta remoto
  try {
    const remote = await fetchDraftRemote();
    if (remote && (remote.title.trim() || remote.content.trim())) {
      titleInput.value = remote.title;
      textarea.value = remote.content;
      updateCount();
      setStatus('Rascunho carregado do servidor.');

      antiTitle?.sync?.();
      antiEssay?.sync?.();

      // atualiza hash p/ não salvar igual logo em seguida
      lastSavedHash = makeHash(remote.title, remote.content);

      // também atualiza local como backup
      saveDraftLocal(remote.title, remote.content);
      return;
    }
  } catch {
    // ignora e tenta local
  }

  // 2) fallback local
  const local = loadDraftLocal();
  if (local && (local.title.trim() || local.content.trim())) {
    titleInput.value = local.title;
    textarea.value = local.content;
    updateCount();
    setStatus('Rascunho carregado (backup local).');

    antiTitle?.sync?.();
    antiEssay?.sync?.();

    lastSavedHash = makeHash(local.title, local.content);

    // tenta sincronizar pro servidor em background (sem travar)
    autosaveNow({ silent: true });
    return;
  }

  updateCount();
}

// ===============================
// SALVAR RASCUNHO (botão)
// ===============================
saveBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title && !text.trim()) {
    // limpa ambos
    clearDraftLocal();
    try {
      await deleteDraftRemote();
    } catch {
      // se não der, ok
    }
    setStatus('Nada para salvar. Rascunho removido.');
    return;
  }

  // salva no servidor (com fallback local)
  await autosaveNow({ silent: false });
});

// ===============================
// CHECAR SE JÁ ENVIOU (bloqueia reenvio)
// ===============================
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

// ===============================
// ENVIAR REDAÇÃO (backend)
// ===============================
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

  // salva rascunho antes de enviar (segurança)
  await autosaveNow({ silent: true });

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

    // remove rascunho local + remoto
    clearDraftLocal();
    try {
      await deleteDraftRemote();
    } catch {
      // ok
    }

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

// ===============================
// INIT
// ===============================
(async () => {
  await carregarTarefa();

  // carrega rascunho do servidor (com fallback)
  await carregarRascunho();

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
