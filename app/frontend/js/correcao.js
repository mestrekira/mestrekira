import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');

if (!taskId) {
  alert('Tarefa inválida.');
  throw new Error('taskId ausente');
}

// 🔹 ELEMENTOS
const essaysList = document.getElementById('essaysList');
const correctionSection = document.getElementById('correctionSection');
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');
const essayContentEl = document.getElementById('essayContent');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const saveBtn = document.getElementById('saveCorrectionBtn');
const statusEl = document.getElementById('status');

let currentEssayId = null;

// 🔹 CARREGAR REDAÇÕES DA TAREFA
async function carregarRedacoes() {
  try {
    const response = await fetch(
      `${API_URL}/essays/by-task/${taskId}/with-student`
    );

    if (!response.ok) throw new Error();

    const essays = await response.json();
    essaysList.innerHTML = '';

    if (essays.length === 0) {
      essaysList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';
      return;
    }

    essays.forEach(essay => {
      const li = document.createElement('li');

      li.textContent = `${essay.studentName} — ${
        essay.score !== null ? `Nota: ${essay.score}` : 'Sem correção'
      }`;

      const btn = document.createElement('button');
      btn.textContent = 'Corrigir';
      btn.onclick = () => abrirCorrecao(essay);

      li.appendChild(btn);
      essaysList.appendChild(li);
    });

  } catch {
    essaysList.innerHTML = '<li>Erro ao carregar redações.</li>';
  }
}

// 🔹 ABRIR REDAÇÃO
function abrirCorrecao(essay) {
  currentEssayId = essay.id;

  studentNameEl.textContent = essay.studentName;
  studentEmailEl.textContent = essay.studentEmail;
  essayContentEl.textContent = essay.content;

  feedbackEl.value = essay.feedback || '';
  scoreEl.value = essay.score ?? '';

  correctionSection.style.display = 'block';
  statusEl.textContent = '';
}

// 🔹 SALVAR CORREÇÃO
saveBtn.addEventListener('click', async () => {
  const feedback = feedbackEl.value.trim();
  const score = Number(scoreEl.value);

  if (!feedback || isNaN(score)) {
    statusEl.textContent = 'Preencha feedback e nota.';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/${currentEssayId}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, score }),
    });

    if (!response.ok) throw new Error();

    statusEl.textContent = 'Correção salva com sucesso!';
    carregarRedacoes();

  } catch {
    statusEl.textContent = 'Erro ao salvar correção.';
  }
});

// 🔹 INIT
carregarRedacoes();
