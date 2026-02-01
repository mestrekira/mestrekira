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

function setMultiline(el, value, fallback = '') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value);
  el.textContent = v.trim() ? v : fallback;
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

// ---------------- fetch helpers ----------------

async function fetchEssayByIdWithStudent(id) {
  // ✅ endpoint professor (com studentName/email)
  const res = await fetch(`${API_URL}/essays/${encodeURIComponent(id)}/with-student`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchEssaysByTaskWithStudent(tId) {
  // ✅ este endpoint você já usa no correcao.js
  const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(tId)}/with-student`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchEssayByTaskAndStudentFallback(tId, sId) {
  // fallback: pode NÃO trazer studentName/email, depende do backend
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
  // aluno (prioriza campos mais comuns)
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

  // redação
  const { title, body } = splitTitleAndBody(essay?.content || '');
  setText(essayTitleEl, title, '—');
  setMultiline(essayBodyEl, body, '');

  // fallback antigo
  if (essayContentEl) setMultiline(essayContentEl, essay?.content || '', '');

  // nota
  const hasScore = essay?.score !== null && essay?.score !== undefined;
  setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida', '—');

  // feedback
  setMultiline(feedbackEl, essay?.feedback || '', 'Aguardando correção do professor.');

  // competências
  setText(c1El, essay?.c1);
  setText(c2El, essay?.c2);
  setText(c3El, essay?.c3);
  setText(c4El, essay?.c4);
  setText(c5El, essay?.c5);
}

async function carregar() {
  try {
    let essay = null;

    // ✅ MODO NOVO: taskId + studentId
    // Melhor forma: pegar /with-student e filtrar (garante studentName/email)
    if (taskId && studentId) {
      let list = [];
      try {
        list = await fetchEssaysByTaskWithStudent(taskId);
      } catch (e) {
        // se falhar, segue pro fallback
        console.warn('[feedback-professor] falhou fetchEssaysByTaskWithStudent:', e);
      }

      if (Array.isArray(list) && list.length) {
        essay = list.find((x) => String(x?.studentId) === String(studentId)) || null;
      }

      // fallback: by-student (pode vir sem nome/email)
      if (!essay) {
        essay = await fetchEssayByTaskAndStudentFallback(taskId, studentId);

        if (!essay) {
          alert('Não encontrei redação para este aluno nesta tarefa (talvez não tenha enviado).');
          window.location.href = 'professor-salas.html';
          return;
        }

        // se o fallback trouxe essay.id, tenta enriquecer com /with-student
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

    // ✅ tema: tenta por essay.taskId (se existir), senão usa taskId da URL
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
