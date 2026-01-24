import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

if (!essayId) {
  alert('Acesso inválido.');
  window.location.href = 'professor-salas.html';
  throw new Error('essayId ausente');
}

// 🔹 ELEMENTOS
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');

const taskTitleEl = document.getElementById('taskTitle');

const essayTitleEl = document.getElementById('essayTitle');
const essayBodyEl = document.getElementById('essayBody');

// fallback antigo (oculto no HTML)
const essayContentEl = document.getElementById('essayContent');

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

const backBtn = document.getElementById('backBtn');

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

function splitTitleAndBody(raw) {
  const text = (raw ?? '').replace(/\r\n/g, '\n'); // normaliza
  const trimmed = text.trim();
  if (!trimmed) return { title: '—', body: '' };

  // pega a primeira linha não vazia como título
  const lines = text.split('\n');

  // encontra índice da primeira linha com conteúdo
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  const title = String(lines[firstIdx] || '').trim();

  // corpo = resto após a linha do título
  const bodyLines = lines.slice(firstIdx + 1);

  // remove linhas vazias iniciais do corpo para não "colar"
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) {
    bodyLines.shift();
  }

  const body = bodyLines.join('\n').trimEnd();

  return { title: title || '—', body };
}

async function carregar() {
  try {
    // ✅ Professor usa esse endpoint
    const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}/with-student`);
    if (!res.ok) throw new Error();

    const essay = await res.json();
    if (!essay) throw new Error();

    setText(studentNameEl, essay.studentName, 'Aluno');
    setText(studentEmailEl, essay.studentEmail, '');

    // ✅ separa título e corpo para não “embaralhar”
    const { title, body } = splitTitleAndBody(essay.content);

    setText(essayTitleEl, title, '—');
    setMultiline(essayBodyEl, body, '');

    // fallback (se alguém abriu HTML antigo)
    if (essayContentEl) setMultiline(essayContentEl, essay.content || '', '');

    // nota + feedback
    setText(
      scoreEl,
      essay.score !== null && essay.score !== undefined ? essay.score : 'Ainda não corrigida'
    );

    setMultiline(feedbackEl, essay.feedback || '', 'Aguardando correção do professor.');

    // competências
    setText(c1El, essay.c1);
    setText(c2El, essay.c2);
    setText(c3El, essay.c3);
    setText(c4El, essay.c4);
    setText(c5El, essay.c5);

    // ✅ Tema (via taskId)
    setText(taskTitleEl, '—');
    if (essay.taskId) {
      try {
        const resTask = await fetch(`${API_URL}/tasks/${encodeURIComponent(essay.taskId)}`);
        if (resTask.ok) {
          const task = await resTask.json();
          setText(taskTitleEl, task?.title, '—');
        }
      } catch {
        // ignora
      }

 console.log('[feedback-professor] essay.taskId =', essay.taskId);

if (essay.taskId) {
  try {
    const url = `${API_URL}/tasks/${encodeURIComponent(essay.taskId)}`;
    console.log('[feedback-professor] fetching:', url);

    const resTask = await fetch(url);
    console.log('[feedback-professor] tasks status:', resTask.status);

    const task = await resTask.json().catch(() => null);
    console.log('[feedback-professor] task payload:', task);

    if (resTask.ok) {
      setText(taskTitleEl, task?.title, '—');
    }
  } catch (e) {
    console.log('[feedback-professor] erro tasks:', e);
  }
}
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
