import { API_URL } from './config.js';
import {
  notify,
  requireStudentSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// ---------------- PARAMS + GUARD ----------------
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

// exige sessão válida de aluno e devolve studentId (compat)
const studentId = requireStudentSession({ redirectTo: 'login-aluno.html' });

if (!essayId) {
  notify('error', 'Acesso inválido', 'Você precisa acessar por uma redação válida.');
  window.location.replace('painel-aluno.html');
  throw new Error('essayId ausente');
}

// ---------------- ELEMENTOS ----------------
const taskTitleEl = document.getElementById('taskTitle');
const essayContentEl = document.getElementById('essayContent');
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

// meta de datas (adicione no HTML: <div id="essayMeta"></div>)
const essayMetaEl = document.getElementById('essayMeta');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

// ---------------- util ----------------
function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

/**
 * Preserva parágrafos e linhas em branco.
 * Funciona tanto para <div>/<p> (textContent) quanto para <textarea>/<input> (value).
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

// ---------------- datas ----------------
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
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  // permite "YYYY-MM-DD HH:mm(:ss)"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d0 = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d0.getTime()) ? null : d0;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const d2 = new Date(asNum);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

function formatDateBR(value) {
  const d = toDateSafe(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return '—';
  }
}

function getSentAt(essay) {
  // enviada = createdAt (ou submittedAt se existir)
  return pickDate(essay, ['submittedAt', 'submitted_at', 'createdAt', 'created_at']);
}

function getCorrectedAt(essay) {
  // corrigida = updatedAt (ou correctedAt)
  return pickDate(essay, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']);
}

function renderEssayMeta(metaEl, essay) {
  if (!metaEl) return;

  const sentAtStr = formatDateBR(getSentAt(essay));
  const correctedAtStr = formatDateBR(getCorrectedAt(essay));

  const hasScore = essay?.score !== null && essay?.score !== undefined;
  const hasFeedback = String(essay?.feedback || '').trim().length > 0;

  // só exibe “Corrigida em” se houver indício real de correção
  const showCorrected = hasScore || hasFeedback;

  metaEl.textContent = '';
  metaEl.style.setProperty('margin-top', '6px', 'important');
  metaEl.style.setProperty('font-size', '12px', 'important');
  metaEl.style.setProperty('opacity', '0.85', 'important');
  metaEl.style.setProperty('white-space', 'pre-wrap', 'important');

  const lines = [`Enviada em: ${sentAtStr}`];
  if (showCorrected) lines.push(`Corrigida em: ${correctedAtStr}`);
  metaEl.textContent = lines.join('\n');
}

// ---------------- redação (render) ----------------
function splitTitleAndBody(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  // padrão com marcador (variações)
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim() || '—',
      body: String(m[2] || '').trimEnd(),
    };
  }

  // fallback: primeira linha não vazia como título
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
const COMP_NAMES = {
  c1: 'Domínio da norma culta',
  c2: 'Compreensão do tema e repertório',
  c3: 'Argumentação e projeto de texto',
  c4: 'Coesão e mecanismos linguísticos',
  c5: 'Proposta de intervenção',
};

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
  const res = await authFetch(
    `${API_URL}/essays/${encodeURIComponent(String(id))}`,
    { method: 'GET' },
    { redirectTo: 'login-aluno.html' }
  );

  if (!res.ok) {
    const msg = await readErrorMessage(res, `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return res.json().catch(() => null);
}

async function fetchTaskTitle(taskId) {
  if (!taskId) return null;

  try {
    const res = await authFetch(
      `${API_URL}/tasks/${encodeURIComponent(String(taskId))}`,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) return null;

    const task = await res.json().catch(() => null);
    return task?.title ? String(task.title) : null;
  } catch (e) {
    if (!String(e?.message || '').startsWith('AUTH_')) console.warn(e);
    return null;
  }
}

// ---------------- CARREGAR FEEDBACK ----------------
async function carregarFeedback() {
  try {
    const essay = await fetchEssayById(essayId);
    if (!essay) throw new Error('Redação não encontrada');

    // 🔐 checagem (front)
    if (String(essay.studentId) !== String(studentId)) {
      notify('error', 'Sem permissão', 'Você não pode ver esta redação.');
      window.location.replace('painel-aluno.html');
      return;
    }

    // meta: enviada/corrigida
    renderEssayMeta(essayMetaEl, essay);

    // tema (task)
    setText(taskTitleEl, '—');
    const taskTitle = await fetchTaskTitle(essay.taskId);
    if (taskTitle) setText(taskTitleEl, taskTitle);

    // redação formatada
    renderEssayFormatted(essayContentEl, essay.content || '');

    // nota
    const hasScore = essay.score !== null && essay.score !== undefined;
    setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

    // feedback
    setMultilinePreserve(
      feedbackEl,
      essay?.feedback || '',
      'Aguardando correção do professor.'
    );

    // competências
    setText(c1El, essay.c1 ?? '—', '—');
    setText(c2El, essay.c2 ?? '—', '—');
    setText(c3El, essay.c3 ?? '—', '—');
    setText(c4El, essay.c4 ?? '—', '—');
    setText(c5El, essay.c5 ?? '—', '—');

    patchCompetencyLabels();
  } catch (err) {
    console.error(err);

    // AUTH_* já redireciona
    if (String(err?.message || '').startsWith('AUTH_')) return;

    notify(
      'error',
      'Erro',
      String(err?.message || 'Erro ao carregar feedback.')
    );
    window.location.replace('painel-aluno.html');
  }
}

// ---------------- VOLTAR ----------------
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'painel-aluno.html';
  });
}

// INIT
carregarFeedback();
