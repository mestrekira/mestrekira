import { API_URL } from './config.js';

// 🔹 PARÂMETROS (aceita 2 modos)
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');      // modo antigo
const taskId = params.get('taskId');        // modo novo
const studentId = params.get('studentId');  // modo novo

if (!essayId && !(taskId && studentId)) {
  alert('Acesso inválido.');
  window.location.href = 'professor-salas.html';
  throw new Error('Parâmetros ausentes (essayId OU taskId+studentId)');
}

// 🔹 ELEMENTOS
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');

const taskTitleEl = document.getElementById('taskTitle');

// ✅ datas (adicione esses IDs no HTML: <div id="essayMeta"></div> OU 2 spans)
const essayMetaEl = document.getElementById('essayMeta');

const essayTitleEl = document.getElementById('essayTitle');
const essayBodyEl = document.getElementById('essayBody');
const essayContentEl = document.getElementById('essayContent'); // fallback antigo (oculto no HTML)

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

const backBtn = document.getElementById('backBtn');

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

/**
 * ✅ Remove marcador e separa título/corpo.
 * Aceita:
 *  - "__TITLE__:Meu título\n\ncorpo..."
 *  - "_TITLE_:Meu título\n\ncorpo..."
 *  - "TITLE:Meu título\n\ncorpo..."
 * Se não achar marcador, usa primeira linha não vazia como título (fallback).
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
function renderEssayFormatted(titleEl, bodyEl, rawContent) {
  const { title, body } = splitTitleAndBody(rawContent);

  setText(titleEl, title || '—', '—');
  setMultilinePreserve(bodyEl, String(body || '').trimEnd(), '');
}

// ---------------- datas ----------------

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v) return v;
  }
  return null;
}

function formatDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

/**
 * ✅ Enviado em (melhor possível):
 * - submittedAt (se existir)
 * - createdAt
 * - created_at
 */
function getSentAt(essay) {
  return pickDate(essay, ['submittedAt', 'submitted_at', 'createdAt', 'created_at']);
}

/**
 * ✅ Corrigido em:
 * - correctedAt (se existir)
 * - updatedAt
 * - updated_at
 * Obs: só mostra se tiver nota (score)
 */
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

  // estilo leve (igual você fez em outras páginas)
  essayMetaEl.textContent = parts.join('  •  ');
  essayMetaEl.style.setProperty('margin-top', '6px', 'important');
  essayMetaEl.style.setProperty('font-size', '12px', 'important');
  essayMetaEl.style.setProperty('opacity', '0.85', 'important');
  essayMetaEl.style.setProperty('white-space', 'pre-wrap', 'important');
}

// ---------------- fetch helpers ----------------

async function fetchEssayByIdWithStudent(id) {
  const res = await fetch(`${API_URL}/essays/${encodeURIComponent(id)}/with-student`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchEssaysByTaskWithStudent(tId) {
  const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(tId)}/with-student`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchEssayByTaskAndStudentFallback(tId, sId) {
  const url =
    `${API_URL}/essays/by-task/${encodeURIComponent(tId)}/by-student` +
    `?studentId=${encodeURIComponent(sId)}`;

  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTask(tId) {
  const res = await fetch(`${API_URL}/tasks/${encodeURIComponent(tId)}`);
  if (!res.ok) return null;
  return res.json();
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

  // redação (formatada e sem duplicar marcador)
  renderEssayFormatted(essayTitleEl, essayBodyEl, essay?.content || '');

  // ✅ NÃO duplicar a redação: se existir o fallback antigo no HTML, esconde.
  // (ele estava mostrando o content cru com _TITLE_)
  if (essayContentEl) {
    essayContentEl.style.display = 'none';
    essayContentEl.textContent = '';
  }

  // ✅ datas
  renderMetaDates(essay);

  // nota
  const hasScore = essay?.score !== null && essay?.score !== undefined;
  setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

  // feedback
  setMultilinePreserve(feedbackEl, essay?.feedback || '', 'Aguardando correção do professor.');

  // competências
  setText(c1El, essay?.c1 ?? '—', '—');
  setText(c2El, essay?.c2 ?? '—', '—');
  setText(c3El, essay?.c3 ?? '—', '—');
  setText(c4El, essay?.c4 ?? '—', '—');
  setText(c5El, essay?.c5 ?? '—', '—');
}

async function carregar() {
  try {
    let essay = null;

    // ✅ MODO NOVO: taskId + studentId
    if (taskId && studentId) {
      let list = [];
      try {
        list = await fetchEssaysByTaskWithStudent(taskId);
      } catch (e) {
        console.warn('[feedback-professor] falhou fetchEssaysByTaskWithStudent:', e);
      }

      if (Array.isArray(list) && list.length) {
        essay = list.find((x) => String(x?.studentId) === String(studentId)) || null;
      }

      // fallback: by-student
      if (!essay) {
        essay = await fetchEssayByTaskAndStudentFallback(taskId, studentId);

        if (!essay) {
          alert('Não encontrei redação para este aluno nesta tarefa (talvez não tenha enviado).');
          window.location.href = 'professor-salas.html';
          return;
        }

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
    alert('Erro ao carregar redação/feedback.');
    window.location.href = 'professor-salas.html';
  }
}

// VOLTAR
if (backBtn) {
  backBtn.addEventListener('click', () => history.back());
}

carregar();
