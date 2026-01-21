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
  const v = (value === null || value === undefined) ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
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

    setText(essayContentEl, essay.content, '');
    setText(scoreEl, (essay.score !== null && essay.score !== undefined) ? essay.score : 'Ainda não corrigida');

    setText(feedbackEl, essay.feedback, 'Aguardando correção do professor.');

    setText(c1El, essay.c1);
    setText(c2El, essay.c2);
    setText(c3El, essay.c3);
    setText(c4El, essay.c4);
    setText(c5El, essay.c5);

    // Tema (via taskId)
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
    }
  } catch {
    alert('Erro ao carregar redação/feedback.');
    window.location.href = 'professor-salas.html';
  }
}

// VOLTAR (volta uma página)
if (backBtn) {
  backBtn.addEventListener('click', () => history.back());
}

carregar();
