import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// 🔹 PARÂMETROS (aceita 2 modos)
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');      // modo antigo
const taskId = params.get('taskId');        // modo novo
const studentId = params.get('studentId');  // modo novo

if (!essayId && !(taskId && studentId)) {
  toast?.({ title: 'Acesso inválido', message: 'Parâmetros ausentes.', type: 'error' });
  window.location.replace('professor-salas.html');
  throw new Error('Parâmetros ausentes (essayId OU taskId+studentId)');
}

// 🔹 ELEMENTOS
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');

const taskTitleEl = document.getElementById('taskTitle');

// ✅ datas (opcional no HTML)
const essayMetaEl = document.getElementById('essayMeta');

const essayTitleEl = document.getElementById('essayTitle');
const essayBodyEl = document.getElementById('essayBody');
const essayContentEl = document.getElementById('essayContent'); // fallback antigo

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

const backBtn = document.getElementById('backBtn');

// ---------------- toast helpers ----------------

function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } else {
    // fallback
    if (type === 'error') alert(`${title}\n\n${message}`);
    else console.log(title, message);
  }
}

// ---------------- auth + fetch helpers ----------------

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
};

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuth() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function requireProfessorSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);
  if (!token || role !== 'PROFESSOR') {
    clearAuth();
    window.location.replace('login-professor.html');
    throw new Error('Sessão de professor ausente/inválida');
  }
  return { token, user };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function unwrapResult(data) {
  // suporta: puro, {ok,result}, {data}
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (data.result && typeof data.result === 'object') return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return data.data;
  }
  return data;
}

async function authFetch(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-professor.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ---------------- util render ----------------

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

/**
 * Preserva parágrafos e linhas em branco.
 */
function setMultilinePreserve(el, value, fallback = '') {
  if (!el) return;

  const raw = value === null || value === undefined ? '' : String(value).replace(/\r\n/g, '\n');
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

/**
 * Remove marcador e separa título/corpo.
 */
function splitTitleAndBody(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim() || '—',
      body: String(m[2] || '').trimEnd(),
    };
  }

  const trimmed = text.trim();
  if (!trimmed) return { title: '—', body: '' };

  const lines = text.split('\n');
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  const title = String(lines[firstIdx] || '').trim() || '—';
  const bodyLines = lines.slice(firstIdx + 1);
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();

  const body = bodyLines.join('\n').trimEnd();
  return { title, body };
}

function renderEssayFormatted(titleEl, bodyEl, rawContent) {
  const { title, body } = splitTitleAndBody(rawContent);
  setText(titleEl, title || '—', '—');
  setMultilinePreserve(bodyEl, String(body || '').trimEnd(), '');
}

// ---------------- datas ----------------

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d2 = new Date(ms);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

function formatDateBR(value) {
  const d = toDateSafe(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  } catch {
    return '—';
  }
}

function getSentAt(essay) {
  return pickDate(essay, ['submittedAt', 'submitted_at', 'createdAt', 'created_at']);
}

function getCorrectedAt(essay) {
  return pickDate(essay, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']);
}

function renderMetaDates(essay) {
  if (!essayMetaEl) return;

  const sentAt = formatDateBR(getSentAt(essay));
  const hasScore = essay?.score !== null && essay?.score !== undefined;
  const correctedAt = hasScore ? formatDateBR(getCorrectedAt(essay)) : '—';

  const parts = [`Enviada em: ${sentAt}`];
  if (hasScore) parts.push(`Corrigida em: ${correctedAt}`);

  essayMetaEl.textContent = parts.join('  •  ');
  essayMetaEl.style.setProperty('margin-top', '6px', 'important');
  essayMetaEl.style.setProperty('font-size', '12px', 'important');
  essayMetaEl.style.setProperty('opacity', '0.85', 'important');
  essayMetaEl.style.setProperty('white-space', 'pre-wrap', 'important');
}

// ---------------- fetch domain ----------------

async function fetchEssayByIdWithStudent(id, token) {
  const data = await authFetch(`/essays/${encodeURIComponent(id)}/with-student`, { token });
  return unwrapResult(data);
}

async function fetchEssaysByTaskWithStudent(tId, token) {
  const data = await authFetch(`/essays/by-task/${encodeURIComponent(tId)}/with-student`, { token });
  return unwrapResult(data);
}

async function fetchEssayByTaskAndStudentFallback(tId, sId, token) {
  const data = await authFetch(
    `/essays/by-task/${encodeURIComponent(tId)}/by-student?studentId=${encodeURIComponent(sId)}`,
    { token },
  );
  return unwrapResult(data);
}

async function fetchTask(tId, token) {
  try {
    const data = await authFetch(`/tasks/${encodeURIComponent(tId)}`, { token });
    return unwrapResult(data);
  } catch {
    return null;
  }
}

// ---------------- render ----------------

function renderEssay(essay) {
  const name =
    essay?.studentName ??
    essay?.student?.name ??
    essay?.student?.fullName ??
    essay?.name ??
    '';

  const email =
    essay?.studentEmail ??
    essay?.student?.email ??
    '';

  setText(studentNameEl, name, 'Aluno');
  setText(studentEmailEl, email, '');

  renderEssayFormatted(essayTitleEl, essayBodyEl, essay?.content || '');

  // não duplicar redação crua
  if (essayContentEl) {
    essayContentEl.style.display = 'none';
    essayContentEl.textContent = '';
  }

  renderMetaDates(essay);

  const hasScore = essay?.score !== null && essay?.score !== undefined;
  setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

  setMultilinePreserve(feedbackEl, essay?.feedback || '', 'Aguardando correção do professor.');

  setText(c1El, essay?.c1 ?? '—', '—');
  setText(c2El, essay?.c2 ?? '—', '—');
  setText(c3El, essay?.c3 ?? '—', '—');
  setText(c4El, essay?.c4 ?? '—', '—');
  setText(c5El, essay?.c5 ?? '—', '—');
}

async function carregar() {
  const { token } = requireProfessorSession();

  try {
    let essay = null;

    // ✅ MODO NOVO: taskId + studentId
    if (taskId && studentId) {
      let list = [];
      try {
        list = await fetchEssaysByTaskWithStudent(taskId, token);
      } catch (e) {
        console.warn('[feedback-professor] falhou fetchEssaysByTaskWithStudent:', e);
      }

      if (Array.isArray(list) && list.length) {
        essay = list.find((x) => String(x?.studentId) === String(studentId)) || null;
      }

      // fallback: by-student
      if (!essay) {
        try {
          essay = await fetchEssayByTaskAndStudentFallback(taskId, studentId, token);
        } catch (e) {
          console.warn('[feedback-professor] falhou fallback by-student:', e);
          essay = null;
        }

        if (!essay) {
          notify(
            'warn',
            'Sem redação',
            'Não encontrei redação para este aluno nesta tarefa (talvez não tenha enviado).',
            3600,
          );
          window.location.replace('professor-salas.html');
          return;
        }

        // tenta enriquecer com /with-student
        if (essay?.id) {
          try {
            const enriched = await fetchEssayByIdWithStudent(essay.id, token);
            if (enriched) essay = enriched;
          } catch (e) {
            console.warn('[feedback-professor] não consegui enriquecer por id:', e);
          }
        }
      }
    } else {
      // ✅ MODO ANTIGO: essayId
      essay = await fetchEssayByIdWithStudent(essayId, token);
    }

    if (!essay) throw new Error('Redação não encontrada');

    renderEssay(essay);

    // tema
    const effectiveTaskId = essay?.taskId || taskId;
    if (effectiveTaskId) {
      const task = await fetchTask(effectiveTaskId, token);
      setText(taskTitleEl, task?.title, '—');
    } else {
      setText(taskTitleEl, '—', '—');
    }
  } catch (err) {
    console.error(err);
    notify('error', 'Erro', 'Erro ao carregar redação/feedback.');
    window.location.replace('professor-salas.html');
  }
}

// VOLTAR
if (backBtn) {
  backBtn.addEventListener('click', () => history.back());
}

carregar();
