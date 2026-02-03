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

// ✅ Empacota título + corpo no content (compatível com seu backend)
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

// ✅ Desempacota (compatível com redações antigas)
function unpackContent(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const re = /^__TITLE__\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return { title: String(m[1] || '').trim(), body: String(m[2] || '') };
  }
  // fallback: sem marcador
  return { title: '', body: text };
}

/**
 * ✅ Renderiza texto preservando parágrafos e linhas em branco
 * Funciona tanto para <div>/<p> quanto para <textarea>/<input>.
 */
function setMultilinePreserve(el, value, fallback = '') {
  if (!el) return;

  const raw = value === null || value === undefined ? '' : String(value).replace(/\r\n/g, '\n');
  const finalText = raw.trim() ? raw : fallback;

  // textarea/input => value; demais => textContent
  if ('value' in el) el.value = finalText;
  else el.textContent = finalText;

  // força preservação
  el.style.setProperty('white-space', 'pre-wrap', 'important');
  el.style.setProperty('line-height', '1.6', 'important');
  el.style.setProperty('text-align', 'justify', 'important');
  el.style.setProperty('overflow-wrap', 'anywhere', 'important');
  el.style.setProperty('word-break', 'break-word', 'important');
  el.style.setProperty('display', 'block', 'important');
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

  // fallback universal (mobile): salto grande de caracteres = cola
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

// ===== BACKEND (ESSAYS COMO RASCUNHO) =====

// Busca a redação do aluno naquela tarefa (rascunho ou enviada)
async function getMyEssayByTask() {
  const url = `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student?studentId=${encodeURIComponent(
    studentId
  )}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (!data) return null;
  return data;
}

// Salva rascunho (upsert) no backend: POST /essays/draft
async function saveDraftServerPacked(packedContent) {
  const res = await fetch(`${API_URL}/essays/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      studentId,
      content: String(packedContent || ''),
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return res.json().catch(() => null);
}

async function clearDraftUXOnly() {
  titleInput.value = '';
  textarea.value = '';
  updateCount();
  antiTitle?.sync?.();
  antiEssay?.sync?.();
}

// 🔹 CARREGAR TAREFA (TEMA + ORIENTAÇÕES)
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) throw new Error();

    const task = await response.json();

    if (taskTitleEl) taskTitleEl.textContent = task?.title || 'Tema da Redação';

    // ✅ AQUI: preserva parágrafos / linhas em branco
    setMultilinePreserve(
      taskGuidelinesEl,
      task?.guidelines,
      'Sem orientações adicionais.'
    );

    // (debug opcional — pode remover depois)
    // console.log('[guidelines json]', JSON.stringify(task?.guidelines));
  } catch (err) {
    console.error('Erro ao carregar tarefa:', err);

    if (taskTitleEl) taskTitleEl.textContent = 'Tema da Redação';

    setMultilinePreserve(
      taskGuidelinesEl,
      '',
      'Não foi possível carregar as orientações.'
    );
  }
}

// ✅ CARREGAR RASCUNHO (BACKEND via essays)
async function carregarRascunho() {
  try {
    const essay = await getMyEssayByTask();

    if (!essay) {
      updateCount();
      return;
    }

    if (essay.isDraft === false && essay.id) {
      setStatus('Você já enviou esta redação. Redirecionando para o feedback...');
      setDisabledAll(true);
      setTimeout(() => {
        window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
      }, 350);
      return;
    }

    const { title, body } = unpackContent(essay.content || '');
    titleInput.value = title || '';
    textarea.value = body || '';
    updateCount();

    antiTitle?.sync?.();
    antiEssay?.sync?.();

    setStatus('Rascunho carregado do servidor.');
  } catch (err) {
    console.error('Erro ao carregar rascunho:', err);
    updateCount();
  }
}

// AUTOSAVE (BACKEND) com debounce
let autosaveTimer = null;
let autosaveBusy = false;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    const title = (titleInput.value || '').trim();
    const text = textarea.value || '';

    if (!title && !text.trim()) return;
    if (autosaveBusy) return;
    autosaveBusy = true;

    try {
      await saveDraftServerPacked(packContent(title, text));
    } catch (err) {
      console.error('Autosave falhou:', err);
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
    await clearDraftUXOnly();
    setStatus('Nada para salvar.');
    return;
  }

  try {
    setStatus('Salvando rascunho...');
    await saveDraftServerPacked(packContent(title, text));
    setStatus('Rascunho salvo no servidor.');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao salvar rascunho no servidor.');
  }
});

// ✅ VERIFICAR SE JÁ ENVIOU
async function checarJaEnviou() {
  try {
    const mine = await getMyEssayByTask();
    if (mine && mine.id && mine.isDraft === false) {
      return { sent: true, essayId: mine.id };
    }
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const essay = await response.json();

    setDisabledAll(true);
    setStatus('Redação enviada com sucesso!');

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 600);
  } catch (err) {
    console.error(err);
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
