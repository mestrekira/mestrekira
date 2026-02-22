import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// =====================
// Toast helper (não quebra se toast não existir)
// =====================
function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } catch {
    if (type === 'error') console.error(title, message);
  }
}

// =====================
// Sessão / Auth helpers
// =====================
function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

function getStudentIdCompat() {
  const id = localStorage.getItem('studentId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

function isStudentSession() {
  const token = localStorage.getItem('token') || '';
  const userJson = localStorage.getItem('user');

  // compat: se ainda não migrou para token/user,
  // ao menos exige studentId (mas o ideal é token + user)
  if (!token || !userJson) {
    return !!getStudentIdCompat();
  }

  try {
    const user = JSON.parse(userJson);
    const role = normRole(user?.role);
    if (role !== 'STUDENT' && role !== 'ALUNO') return false;

    // garante studentId compatível com páginas antigas
    if (user?.id && !getStudentIdCompat()) {
      localStorage.setItem('studentId', String(user.id));
    }

    return true;
  } catch {
    return false;
  }
}

function getToken() {
  return localStorage.getItem('token') || '';
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-aluno.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

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
// PARÂMETROS
// =====================
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');

// compat: studentId antigo, mas preferimos token/user
const studentId = getStudentIdCompat();

if (!taskId || !isStudentSession() || !studentId) {
  notify('error', 'Acesso inválido', 'Você precisa acessar por uma tarefa válida.');
  window.location.replace('painel-aluno.html');
  throw new Error('Parâmetros/sessão ausentes');
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
  titleInput.disabled = !!disabled;
  textarea.disabled = !!disabled;
  saveBtn.disabled = !!disabled;
  sendBtn.disabled = !!disabled;
}

function updateCount() {
  charCount.textContent = String((textarea.value || '').length);
}

// =====================
// Pack / Unpack (título + corpo no content)
// =====================
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

function unpackContent(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  // aceita variações (compat com seu ecossistema)
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);

  if (m) {
    return { title: String(m[1] || '').trim(), body: String(m[2] || '') };
  }

  return { title: '', body: text };
}

/**
 * ✅ Preserva parágrafos e linhas em branco.
 */
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
// Anti-paste / anti-drop (com fallback mobile)
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
      2600,
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

  // fallback universal (mobile): salto grande de caracteres = provável cola
  el.addEventListener('input', () => {
    const cur = el.value || '';
    const curLen = cur.length;
    const diff = curLen - lastLen;

    // só bloqueia saltos POSITIVOS grandes (evita falsos positivos em delete)
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
// BACKEND (ESSAYS como rascunho)
// =====================

// Busca a redação do aluno naquela tarefa (rascunho ou enviada)
async function getMyEssayByTask() {
  const url =
    `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student` +
    `?studentId=${encodeURIComponent(studentId)}`;

  const res = await authFetch(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json().catch(() => null);
  return data || null;
}

// Salva rascunho (upsert) no backend: POST /essays/draft
async function saveDraftServerPacked(packedContent) {
  const res = await authFetch(`${API_URL}/essays/draft`, {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      studentId,
      content: String(packedContent || ''),
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      const m = data?.message ?? data?.error;
      if (Array.isArray(m)) msg = m.join(' | ');
      else if (typeof m === 'string' && m.trim()) msg = m;
    } catch {}
    throw new Error(msg);
  }

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
// CARREGAR TAREFA (tema + orientações)
// =====================
async function carregarTarefa() {
  try {
    const response = await authFetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const task = await response.json().catch(() => null);

    if (taskTitleEl) taskTitleEl.textContent = task?.title || 'Tema da Redação';

    // preserva parágrafos / linhas em branco
    setMultilinePreserve(taskGuidelinesEl, task?.guidelines, 'Sem orientações adicionais.');
  } catch (err) {
    console.error('Erro ao carregar tarefa:', err);

    if (taskTitleEl) taskTitleEl.textContent = 'Tema da Redação';
    setMultilinePreserve(taskGuidelinesEl, '', 'Não foi possível carregar as orientações.');

    notify('error', 'Erro', 'Erro ao carregar a tarefa.');
  }
}

// =====================
// CARREGAR RASCUNHO (via essays)
// =====================
async function carregarRascunho() {
  try {
    const essay = await getMyEssayByTask();

    if (!essay) {
      updateCount();
      return;
    }

    // já enviada -> redireciona
    if (essay.isDraft === false && essay.id) {
      setStatus('Você já enviou esta redação. Redirecionando para o feedback...');
      setDisabledAll(true);

      setTimeout(() => {
        window.location.replace(`feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`);
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
// AUTOSAVE (debounce + proteção)
// =====================
let autosaveTimer = null;
let autosaveBusy = false;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    const title = (titleInput.value || '').trim();
    const text = textarea.value || '';

    // não salva “vazio”
    if (!title && !text.trim()) return;

    // evita concorrência
    if (autosaveBusy) return;
    autosaveBusy = true;

    try {
      await saveDraftServerPacked(packContent(title, text));
    } catch (err) {
      // silencioso (não polui UX)
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
// SALVAR RASCUNHO (manual)
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

  // evita spam de clique
  saveBtn.disabled = true;

  try {
    setStatus('Salvando rascunho...');
    await saveDraftServerPacked(packContent(title, text));
    setStatus('Rascunho salvo no servidor.');
    notify('success', 'Salvo', 'Rascunho salvo no servidor.');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao salvar rascunho no servidor.');
    notify('error', 'Erro', 'Erro ao salvar rascunho no servidor.');
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
      return { sent: true, essayId: mine.id };
    }
    return { sent: false };
  } catch {
    return { sent: false };
  }
}

// (PARTE 2 continua daqui: ENVIAR REDAÇÃO + flush autosave + INIT)

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

  // trava UI
  setDisabledAll(true);
  setStatus('Verificando envio...');

  try {
    // revalida no servidor (evita reenviar por múltiplas abas)
    const ja = await checarJaEnviou();
    if (ja.sent) {
      setStatus('Você já enviou esta redação. Não é permitido reenviar.');
      notify('info', 'Já enviada', 'Você já enviou esta redação.');
      window.location.replace(`feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`);
      return;
    }

    // opcional: salva o último estado como rascunho antes do envio final
    try {
      await saveDraftServerPacked(packContent(title, text));
    } catch (e) {
      console.warn('[redacao] Falha ao salvar rascunho antes do envio:', e);
      // segue mesmo assim
    }

    setStatus('Enviando redação...');

    const response = await authFetch(`${API_URL}/essays`, {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        studentId,
        content: packContent(title, text),
      }),
    });

    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        const m = data?.message ?? data?.error;
        if (Array.isArray(m)) msg = m.join(' | ');
        else if (typeof m === 'string' && m.trim()) msg = m;
      } catch {}
      throw new Error(msg);
    }

    const essay = await response.json().catch(() => null);

    setStatus('Redação enviada com sucesso!');
    notify('success', 'Enviada!', 'Redação enviada com sucesso.');

    const essayId = essay?.id ? String(essay.id) : '';
    if (!essayId) {
      notify(
        'warn',
        'Enviada',
        'Redação enviada, mas não consegui obter o ID para abrir o feedback automaticamente.',
        4200,
      );
      return;
    }

    setTimeout(() => {
      window.location.replace(`feedback-aluno.html?essayId=${encodeURIComponent(essayId)}`);
    }, 600);
  } catch (err) {
    console.error(err);
    sending = false;

    // destrava UI
    setDisabledAll(false);

    setStatus('Erro ao enviar redação.');
    notify('error', 'Erro', 'Erro ao enviar redação.');
  }
});

// =====================
// FLUSH de autosave ao sair da página
// (evita perder texto quando o usuário fecha a aba)
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
  // não dá para "await" aqui — mas dispara tentativa final
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
        window.location.replace(`feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`);
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
  }
})();
