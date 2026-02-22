// feedback-professor.js (final / prático)
// - usa auth.js (requireProfessorSession + authFetch + readErrorMessage + notify)
// - aceita 2 modos:
//   1) antigo: ?essayId=...
//   2) novo:   ?taskId=...&studentId=...
// - preserva parágrafos (redação + feedback)
// - compatível com content empacotado __TITLE__:

import { API_URL } from './config.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// ---------------- PARAMS ----------------
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId'); // modo antigo
const taskId = params.get('taskId'); // modo novo
const studentId = params.get('studentId'); // modo novo

// sessão obrigatória
requireProfessorSession({ redirectTo: 'login-professor.html' });

if (!essayId && !(taskId && studentId)) {
  notify('error', 'Acesso inválido', 'Parâmetros ausentes.');
  window.location.replace('professor-salas.html');
  throw new Error('Parâmetros ausentes (essayId OU taskId+studentId)');
}

// ---------------- ELEMENTOS ----------------
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');

const taskTitleEl = document.getElementById('taskTitle');

// datas (opcional no HTML)
const essayMetaEl = document.getElementById('essayMeta');

// modo novo (se existir no HTML)
const essayTitleEl = document.getElementById('essayTitle');
const essayBodyEl = document.getElementById('essayBody');

// fallback antigo (se existir no HTML)
const essayContentEl = document.getElementById('essayContent');

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

const backBtn = document.getElementById('backBtn');

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

/**
 * Remove marcador e separa título/corpo.
 */
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

  // fallback: primeira linha não vazia vira título
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

  let title = String(lines[firstIdx] || '').trim();
  if (title.startsWith('__TITLE__:')) title = title.replace(/^__TITLE__:\s*/, '').trim();

  const bodyLines = lines.slice(firstIdx + 1);
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();

  const body = bodyLines.join('\n').trimEnd();
  return { title: title || '—', body };
}

function renderEssayFormatted(rawContent) {
  const { title, body } = splitTitleAndBody(rawContent);

  // Preferência: se HTML tem title/body separados (novo)
  if (essayTitleEl && essayBodyEl) {
    setText(essayTitleEl, title || '—', '—');
    setMultilinePreserve(essayBodyEl, body || '', '');
    if (essayContentEl) {
      essayContentEl.style.display = 'none';
      essayContentEl.textContent = '';
    }
    return;
  }

  // Fallback: caixa única (antigo)
  if (essayContentEl) {
    essayContentEl.innerHTML = '';
    essayContentEl.style.setProperty('white-space', 'pre-wrap', 'important');
    essayContentEl.style.setProperty('line-height', '1.6', 'important');
    essayContentEl.style.setProperty('text-align', 'justify', 'important');
    essayContentEl.style.setProperty('overflow-wrap', 'anywhere', 'important');
    essayContentEl.style.setProperty('word-break', 'break-word', 'important');

    const h = document.createElement('div');
    h.textContent = title || '—';
    h.style.textAlign = 'center';
    h.style.fontWeight = '800';
    h.style.marginBottom = '10px';
    essayContentEl.appendChild(h);

    const b = document.createElement('div');
    b.textContent = String(body || '').replace(/\r\n/g, '\n').trimEnd();
    b.style.whiteSpace = 'pre-wrap';
    b.style.textAlign = 'justify';
    essayContentEl.appendChild(b);
  }
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

  // aceita "YYYY-MM-DD HH:mm(:ss)"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d0 = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d0.getTime()) ? null : d0;
  }

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
  const hasFeedback = String(essay?.feedback || '').trim().length > 0;
  const showCorrected = hasScore || hasFeedback;

  const correctedAt = showCorrected ? formatDateBR(getCorrectedAt(essay)) : '—';

  const parts = [`Enviada em: ${sentAt}`];
  if (showCorrected) parts.push(`Corrigida em: ${correctedAt}`);

  essayMetaEl.textContent = parts.join('  •  ');
  essayMetaEl.style.setProperty('margin-top', '6px', 'important');
  essayMetaEl.style.setProperty('font-size', '12px', 'important');
  essayMetaEl.style.setProperty('opacity', '0.85', 'important');
  essayMetaEl.style.setProperty('white-space', 'pre-wrap', 'important');
}

// ---------------- fetch helpers ----------------
function unwrapResult(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.result && typeof data.result === 'object') return data.result;
    if (data.data && typeof data.data === 'object') return data.data;
  }
  return data;
}

async function apiJson(url, options) {
  const res = await authFetch(url, options || {}, { redirectTo: 'login-professor.html' });
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function fetchEssayByIdWithStudent(id) {
  const data = await apiJson(`${API_URL}/essays/${encodeURIComponent(String(id))}/with-student`, {
    method: 'GET',
  });
  return unwrapResult(data);
}

async function fetchEssaysByTaskWithStudent(tId) {
  const data = await apiJson(
    `${API_URL}/essays/by-task/${encodeURIComponent(String(tId))}/with-student`,
    { method: 'GET' }
  );
  return unwrapResult(data);
}

async function fetchEssayByTaskAndStudentFallback(tId, sId) {
  // retorna essay (pode ser objeto ou null/404)
  const res = await authFetch(
    `${API_URL}/essays/by-task/${encodeURIComponent(String(tId))}/by-student?studentId=${encodeURIComponent(String(sId))}`,
    { method: 'GET' },
    { redirectTo: 'login-professor.html' }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));

  const data = await res.json().catch(() => null);
  return unwrapResult(data);
}

async function fetchTask(tId) {
  try {
    const data = await apiJson(`${API_URL}/tasks/${encodeURIComponent(String(tId))}`, {
      method: 'GET',
    });
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

  const email = essay?.studentEmail ?? essay?.student?.email ?? '';

  setText(studentNameEl, name, 'Aluno');
  setText(studentEmailEl, email, '');

  renderEssayFormatted(essay?.content || '');

  renderMetaDates(essay);

  const hasScore = essay?.score !== null && essay?.score !== undefined;
  setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

  setMultilinePreserve(feedbackEl, essay?.feedback || '', 'Sem feedback registrado.');

  setText(c1El, essay?.c1 ?? '—', '—');
  setText(c2El, essay?.c2 ?? '—', '—');
  setText(c3El, essay?.c3 ?? '—', '—');
  setText(c4El, essay?.c4 ?? '—', '—');
  setText(c5El, essay?.c5 ?? '—', '—');
}

// ---------------- main ----------------
async function carregar() {
  try {
    let essay = null;

    // ✅ MODO NOVO: taskId + studentId
    if (taskId && studentId) {
      let list = null;

      try {
        list = await fetchEssaysByTaskWithStudent(taskId);
      } catch (e) {
        console.warn('[feedback-professor] falhou by-task/with-student:', e);
      }

      if (Array.isArray(list) && list.length) {
        essay = list.find((x) => String(x?.studentId) === String(studentId)) || null;
      }

      // fallback: by-student (pode vir 404 se não enviou)
      if (!essay) {
        const fallbackEssay = await fetchEssayByTaskAndStudentFallback(taskId, studentId);
        if (!fallbackEssay) {
          notify(
            'warn',
            'Sem redação',
            'Não encontrei redação para este aluno nesta tarefa (talvez não tenha enviado).',
            3600
          );
          window.location.replace(`correcao.html?taskId=${encodeURIComponent(String(taskId))}`);
          return;
        }

        essay = fallbackEssay;

        // tenta enriquecer com /with-student
        if (essay?.id) {
          try {
            const enriched = await fetchEssayByIdWithStudent(essay.id);
            if (enriched) essay = enriched;
          } catch (e) {
            console.warn('[feedback-professor] não consegui enriquecer por id:', e);
          }
        }
      }
    } else {
      // ✅ MODO ANTIGO: essayId
      essay = await fetchEssayByIdWithStudent(essayId);
    }

    if (!essay) throw new Error('Redação não encontrada');

    renderEssay(essay);

    // tema
    const effectiveTaskId = essay?.taskId || taskId;
    if (effectiveTaskId) {
      const task = await fetchTask(effectiveTaskId);
      setText(taskTitleEl, task?.title, '—');
    } else {
      setText(taskTitleEl, '—', '—');
    }
  } catch (err) {
    console.error(err);

    // AUTH_* já redireciona
    if (String(err?.message || '').startsWith('AUTH_')) return;

    notify('error', 'Erro', 'Erro ao carregar redação/feedback.');
    window.location.replace('professor-salas.html');
  }
}

// ---------------- VOLTAR ----------------
if (backBtn) {
  backBtn.addEventListener('click', () => {
    // se veio do fluxo novo, volta para a lista da tarefa
    if (taskId) {
      window.location.href = `correcao.html?taskId=${encodeURIComponent(String(taskId))}`;
      return;
    }
    // caso contrário, volta ao histórico
    history.back();
  });
}

carregar();
