import { API_URL } from './config.js';
import { notify, requireStudentSession, authFetch, readErrorMessage } from './auth.js';

// =====================
// ELEMENTOS
// =====================
const titleInput = document.getElementById('essayTitle');
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');

const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

const taskTitleEl = document.getElementById('taskTitle');
const taskGuidelinesEl = document.getElementById('taskGuidelines');

// =====================
// PARÂMETROS + GUARD
// =====================
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');

const studentId = requireStudentSession({ redirectTo: 'login-aluno.html' });

if (!taskId) {
  notify('error', 'Acesso inválido', 'Você precisa acessar por uma tarefa válida.');
  window.location.replace('painel-aluno.html');
  throw new Error('taskId ausente');
}

if (!titleInput || !textarea || !charCount || !status || !sendBtn || !saveBtn) {
  console.error('HTML incompleto em redacao.html');
  throw new Error('Elementos não encontrados');
}

// =====================
// UI helpers
// =====================
function setStatus(msg) {
  status.textContent = msg || '';
}

function setDisabledAll(disabled) {
  const d = !!disabled;
  titleInput.disabled = d;
  textarea.disabled = d;
  saveBtn.disabled = d;
  sendBtn.disabled = d;
}

function updateCount() {
  charCount.textContent = String((textarea.value || '').length);
}

// =====================
// Pack / Unpack
// =====================
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

function unpackContent(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);

  if (m) {
    return { title: String(m[1] || '').trim(), body: String(m[2] || '') };
  }

  return { title: '', body: text };
}

function setMultilinePreserve(el, value, fallback = '') {
  if (!el) return;

  const raw =
    value === null || value === undefined ? '' : String(value).replace(/\r\n/g, '\n');
  const finalText = raw.trim() ? raw : fallback;

  if ('value' in el) el.value = finalText;
  else el.textContent = finalText;

  el.style.setProperty('white-space', 'pre-wrap', 'important');
  el.style.setProperty('line-height', '1.6', 'important');
  el.style.setProperty('text-align', 'justify', 'important');
  el.style.setProperty('overflow-wrap', 'anywhere', 'important');
  el.style.setProperty('word-break', 'break-word', 'important');
  el.style.setProperty('display', 'block', 'important');
}

// =====================
// Anti-paste / anti-drop
// =====================
function antiPaste(el, fieldName, options = {}) {
  if (!el) return null;

  const maxJump = Number(options.maxJump ?? 25);
  let lastValue = el.value || '';
  let lastLen = lastValue.length;

  function warn() {
    notify(
      'warn',
      'Ação bloqueada',
      `Colar texto não é permitido em ${fieldName}. Digite no sistema.`,
      2600
    );
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

// =====================
// BACKEND (ESSAYS)
// =====================
async function getMyEssayByTask() {
  const url =
    `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student` +
    `?studentId=${encodeURIComponent(studentId)}`;

  const res = await authFetch(url, {}, { redirectTo: 'login-aluno.html' });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));

  const data = await res.json().catch(() => null);
  return data || null;
}

async function saveDraftServerPacked(packedContent) {
  const res = await authFetch(
    `${API_URL}/essays/draft`,
    {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        studentId,
        content: String(packedContent || ''),
      }),
    },
    { redirectTo: 'login-aluno.html' }
  );

  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function clearDraftUXOnly() {
  titleInput.value = '';
  textarea.value = '';
  updateCount();
  antiTitle?.sync?.();
  antiEssay?.sync?.();
}

// =====================
// CARREGAR TAREFA
// ✅ agora usa rota do aluno
// =====================
async function carregarTarefa() {
  try {
    const res = await authFetch(
      `${API_URL}/tasks/student/${encodeURIComponent(taskId)}`,
      {},
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));

    const task = await res.json().catch(() => null);

    if (taskTitleEl) taskTitleEl.textContent = task?.title || 'Tema da Redação';
    setMultilinePreserve(taskGuidelinesEl, task?.guidelines, 'Sem orientações adicionais.');
  } catch (err) {
    console.error('Erro ao carregar tarefa:', err);

    if (taskTitleEl) taskTitleEl.textContent = 'Tema da Redação';
    setMultilinePreserve(taskGuidelinesEl, '', 'Não foi possível carregar as orientações.');

    notify('error', 'Erro', 'Erro ao carregar a tarefa.');
  }
}

// =====================
// CARREGAR RASCUNHO
// =====================
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
        window.location.replace(
          `feedback-aluno.html?essayId=${encodeURIComponent(String(essay.id))}`
        );
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

// =====================
// AUTOSAVE
// =====================
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

// =====================
// SALVAR RASCUNHO
// =====================
saveBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title && !text.trim()) {
    await clearDraftUXOnly();
    setStatus('Nada para salvar.');
    notify('info', 'Nada a salvar', 'O rascunho está vazio.');
    return;
  }

  saveBtn.disabled = true;

  try {
    setStatus('Salvando rascunho...');
    await saveDraftServerPacked(packContent(title, text));
    setStatus('Rascunho salvo no servidor.');
    notify('success', 'Salvo', 'Rascunho salvo no servidor.');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao salvar rascunho no servidor.');
    notify('error', 'Erro', String(err?.message || 'Erro ao salvar rascunho no servidor.'));
  } finally {
    saveBtn.disabled = false;
  }
});

// =====================
// VERIFICAR SE JÁ ENVIOU
// =====================
async function checarJaEnviou() {
  try {
    const mine = await getMyEssayByTask();
    if (mine && mine.id && mine.isDraft === false) {
      return { sent: true, essayId: String(mine.id) };
    }
    return { sent: false };
  } catch {
    return { sent: false };
  }
}

// =====================
// ENVIAR REDAÇÃO
// =====================
let sending = false;

sendBtn.addEventListener('click', async () => {
  if (sending) return;
  sending = true;

  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title) {
    notify('warn', 'Campo obrigatório', 'Informe o título da redação.');
    sending = false;
    return;
  }

  if (text.length < 500) {
    notify('warn', 'Texto muito curto', 'A redação deve ter pelo menos 500 caracteres.');
    sending = false;
    return;
  }

  setDisabledAll(true);
  setStatus('Verificando envio...');

  try {
    const ja = await checarJaEnviou();
    if (ja.sent) {
      setStatus('Você já enviou esta redação. Não é permitido reenviar.');
      notify('info', 'Já enviada', 'Você já enviou esta redação.');
      window.location.replace(
        `feedback-aluno.html?essayId=${encodeURIComponent(String(ja.essayId || ''))}`
      );
      return;
    }

    try {
      await saveDraftServerPacked(packContent(title, text));
    } catch (e) {
      console.warn('[redacao] Falha ao salvar rascunho antes do envio:', e);
    }

    setStatus('Enviando redação...');

    const res = await authFetch(
      `${API_URL}/essays`,
      {
        method: 'POST',
        body: JSON.stringify({
          taskId,
          studentId,
          content: packContent(title, text),
        }),
      },
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));

    const essay = await res.json().catch(() => null);

    setStatus('Redação enviada com sucesso!');
    notify('success', 'Enviada!', 'Redação enviada com sucesso.');

    const newEssayId = essay?.id ? String(essay.id) : '';
    if (!newEssayId) {
      notify(
        'warn',
        'Enviada',
        'Redação enviada, mas não consegui obter o ID para abrir o feedback automaticamente.',
        4200
      );
      return;
    }

    setTimeout(() => {
      window.location.replace(`feedback-aluno.html?essayId=${encodeURIComponent(newEssayId)}`);
    }, 600);
  } catch (err) {
    console.error(err);
    setDisabledAll(false);
    setStatus('Erro ao enviar redação.');
    notify('error', 'Erro', String(err?.message || 'Erro ao enviar redação.'));
  } finally {
    sending = false;
  }
});

// =====================
// FLUSH do autosave
// =====================
async function flushAutosave() {
  try {
    const title = (titleInput.value || '').trim();
    const text = textarea.value || '';

    if (!title && !text.trim()) return;
    if (autosaveBusy) return;

    autosaveBusy = true;
    await saveDraftServerPacked(packContent(title, text));
  } catch {
    // silencioso
  } finally {
    autosaveBusy = false;
  }
}

window.addEventListener('pagehide', () => {
  flushAutosave();
});

// =====================
// INIT
// =====================
(async () => {
  try {
    await carregarTarefa();

    setStatus('Verificando envio...');
    const ja = await checarJaEnviou();

    if (ja.sent) {
      setStatus('Você já enviou esta redação. Redirecionando para o feedback...');
      setDisabledAll(true);

      setTimeout(() => {
        window.location.replace(
          `feedback-aluno.html?essayId=${encodeURIComponent(String(ja.essayId || ''))}`
        );
      }, 400);

      return;
    }

    setStatus('Carregando rascunho...');
    await carregarRascunho();
    setStatus('');
    updateCount();
  } catch (e) {
    console.error(e);
    setStatus('Erro ao inicializar a página.');
    notify('error', 'Erro', String(e?.message || 'Erro ao inicializar a página.'));
  }
})();
