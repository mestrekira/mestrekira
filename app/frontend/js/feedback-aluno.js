// feedback-aluno.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');
const studentId = localStorage.getItem('studentId');

if (!essayId || !studentId || studentId === 'undefined' || studentId === 'null') {
  toast?.({
    title: 'Acesso inválido',
    message: 'Você precisa acessar por uma redação válida.',
    type: 'error',
    duration: 3200,
  });
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// 🔹 ELEMENTOS
const taskTitleEl = document.getElementById('taskTitle');
const essayContentEl = document.getElementById('essayContent');
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

// ✅ NOVO: meta de datas (adicione no HTML: <div id="essayMeta"></div>)
const essayMetaEl = document.getElementById('essayMeta');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

// ---------------- toast/status helpers ----------------

function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration: duration ?? (type === 'error' ? 4200 : type === 'warn' ? 3200 : 2400),
    });
  } else {
    // fallback (caso ui-feedback.js não esteja carregando por algum motivo)
    if (type === 'error') alert(`${title}\n\n${message}`);
  }
}

// ---------------- Auth fetch (token) ----------------

function getToken() {
  return localStorage.getItem('token') || '';
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

async function errorMessageFromResponse(res) {
  try {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const m = data?.message ?? data?.error;
      if (Array.isArray(m)) return m.join(' | ');
      if (typeof m === 'string' && m.trim()) return m;
    }
    const t = await res.text().catch(() => '');
    if (t && t.trim()) return t.slice(0, 300);
  } catch {
    // ignora
  }
  return `Erro (HTTP ${res.status}).`;
}

async function jsonSafe(res) {
  return res.json().catch(() => null);
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // só define JSON se houver body e o header ainda não foi definido
  if (!headers['Content-Type'] && options.body) {
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

// ---------------- util ----------------

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

/**
 * ✅ Preserva parágrafos e linhas em branco.
 * Funciona tanto para <div>/<p> (textContent) quanto para <textarea>/<input> (value).
 * Também força CSS com prioridade para não “embaralhar”.
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

// ---------------- datas (robusto) ----------------

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    const t = d.getTime();
    return Number.isNaN(t) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  const d = new Date(s);
  const t = d.getTime();
  if (!Number.isNaN(t)) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const d2 = new Date(asNum);
    const t2 = d2.getTime();
    return Number.isNaN(t2) ? null : d2;
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

// ✅ enviada = createdAt (ou submittedAt se existir no futuro)
function getSentAt(essay) {
  return pickDate(essay, ['submittedAt', 'submitted_at', 'createdAt', 'created_at']);
}

// ✅ corrigida = updatedAt (mas só faz sentido quando já houve correção)
function getCorrectedAt(essay) {
  return pickDate(essay, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']);
}

function renderEssayMeta(metaEl, essay) {
  if (!metaEl) return;

  const sentAtStr = formatDateBR(getSentAt(essay));
  const correctedAtStr = formatDateBR(getCorrectedAt(essay));

  const hasScore = essay?.score !== null && essay?.score !== undefined;
  const hasFeedback = String(essay?.feedback || '').trim().length > 0;

  // regra: só exibir “Corrigida em” se houver indício real de correção
  const showCorrected = hasScore || hasFeedback;

  metaEl.textContent = '';
  metaEl.style.setProperty('margin-top', '6px', 'important');
  metaEl.style.setProperty('font-size', '12px', 'important');
  metaEl.style.setProperty('opacity', '0.85', 'important');
  metaEl.style.setProperty('white-space', 'pre-wrap', 'important');

  const lines = [];
  lines.push(`Enviada em: ${sentAtStr}`);
  if (showCorrected) lines.push(`Corrigida em: ${correctedAtStr}`);

  metaEl.textContent = lines.join('\n');
}

// ---------------- redação ----------------

/**
 * ✅ Separa título e corpo, aceitando:
 *  - "__TITLE__:Meu título\n\ncorpo..."
 *  - "_TITLE_:Meu título\n\ncorpo..." (legado)
 *  - "TITLE:Meu título\n\ncorpo..."  (legado)
 * Se não achar marcador, usa primeira linha não vazia como título.
 */
function splitTitleAndBody(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  // 1) padrão com marcador (variações)
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim() || '—',
      body: String(m[2] || '').trimEnd(),
    };
  }

  // 2) fallback: primeira linha não vazia como título
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

  // remove linhas vazias iniciais do corpo
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();

  const body = bodyLines.join('\n').trimEnd();
  return { title, body };
}

/**
 * ✅ Renderiza a redação:
 * - título centralizado
 * - corpo justificado
 * - preserva quebras/linhas em branco
 */
function renderEssayFormatted(containerEl, rawContent) {
  if (!containerEl) return;

  const { title, body } = splitTitleAndBody(rawContent);

  containerEl.innerHTML = '';
  containerEl.style.setProperty('white-space', 'pre-wrap', 'important');
  containerEl.style.setProperty('text-align', 'justify', 'important');
  containerEl.style.setProperty('line-height', '1.6', 'important');
  containerEl.style.setProperty('overflow-wrap', 'anywhere', 'important');
  containerEl.style.setProperty('word-break', 'break-word', 'important');

  const h = document.createElement('div');
  h.textContent = title || '—';
  h.style.textAlign = 'center';
  h.style.fontWeight = '700';
  h.style.marginBottom = '10px';
  containerEl.appendChild(h);

  const b = document.createElement('div');
  b.textContent = String(body || '').replace(/\r\n/g, '\n').trimEnd();
  b.style.textAlign = 'justify';
  b.style.whiteSpace = 'pre-wrap';
  containerEl.appendChild(b);
}

// ---------------- competências ----------------

// nomes das competências (ENEM)
const COMP_NAMES = {
  c1: 'Domínio da norma culta',
  c2: 'Compreensão do tema e repertório',
  c3: 'Argumentação e projeto de texto',
  c4: 'Coesão e mecanismos linguísticos',
  c5: 'Proposta de intervenção',
};

// ✅ ajusta os <strong> do HTML para incluir o nome da competência
function patchCompetencyLabels() {
  const map = [
    { id: 'c1', name: COMP_NAMES.c1 },
    { id: 'c2', name: COMP_NAMES.c2 },
    { id: 'c3', name: COMP_NAMES.c3 },
    { id: 'c4', name: COMP_NAMES.c4 },
    { id: 'c5', name: COMP_NAMES.c5 },
  ];

  map.forEach(({ id, name }) => {
    const span = document.getElementById(id);
    if (!span) return;

    const p = span.closest('p');
    if (!p) return;

    const strong = p.querySelector('strong');
    if (!strong) return;

    const base = strong.textContent || '';
    if (base.includes('(')) return; // evita duplicar
    strong.textContent = base.replace(':', ` (${name}):`);
  });
}

// ---------------- fetch helpers ----------------

async function fetchEssayById(id) {
  const res = await authFetch(`${API_URL}/essays/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const msg = await errorMessageFromResponse(res);
    throw new Error(msg);
  }
  return jsonSafe(res);
}

async function fetchTaskTitle(taskId) {
  if (!taskId) return null;

  try {
    const res = await authFetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!res.ok) return null;
    const task = await jsonSafe(res);
    return task?.title ? String(task.title) : null;
  } catch (e) {
    if (!String(e?.message || '').startsWith('AUTH_')) console.warn(e);
    return null;
  }
}

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    // 1) redação
    const essay = await fetchEssayById(essayId);

    if (!essay) throw new Error('Redação não encontrada');

    // 🔐 checagem (front)
    if (String(essay.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'painel-aluno.html';
      return;
    }

    // ✅ meta: enviada/corrigida
    renderEssayMeta(essayMetaEl, essay);

    // 2) tema (task)
    setText(taskTitleEl, '—');
    if (essay.taskId) {
      try {
        const task = await fetchTaskById(essay.taskId);
        if (task) setText(taskTitleEl, task?.title || '—');
      } catch {
        // ignora
      }
    }

    // 3) redação formatada (preserva parágrafos)
    renderEssayFormatted(essayContentEl, essay.content || '');

    // 4) nota
    const hasScore = essay.score !== null && essay.score !== undefined;
    setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

    // 5) feedback (preserva parágrafos/linhas em branco)
    setMultilinePreserve(
      feedbackEl,
      essay?.feedback || '',
      'Aguardando correção do professor.',
    );

    // 6) competências
    setText(c1El, essay.c1 ?? '—', '—');
    setText(c2El, essay.c2 ?? '—', '—');
    setText(c3El, essay.c3 ?? '—', '—');
    setText(c4El, essay.c4 ?? '—', '—');
    setText(c5El, essay.c5 ?? '—', '—');

    // 7) nomes das competências no label
    patchCompetencyLabels();
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar feedback.');
    window.location.href = 'painel-aluno.html';
  }
}

// 🔹 VOLTAR
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'painel-aluno.html';
  });
}

// INIT
carregarFeedback();

