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
const saveBtn = document.getElementById('saveCorrectionBtn');
const statusEl = document.getElementById('status');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');
const totalScoreEl = document.getElementById('totalScore');

let currentEssayId = null;

function clamp200(n) {
  if (Number.isNaN(n)) return null;
  if (n < 0) return 0;
  if (n > 200) return 200;
  return n;
}

function calcularTotal() {
  const v1 = clamp200(Number(c1El.value));
  const v2 = clamp200(Number(c2El.value));
  const v3 = clamp200(Number(c3El.value));
  const v4 = clamp200(Number(c4El.value));
  const v5 = clamp200(Number(c5El.value));

  // se algum estiver vazio, não calcula total
  if ([v1, v2, v3, v4, v5].some(v => v === null)) {
    totalScoreEl.textContent = '—';
    return null;
  }

  const total = v1 + v2 + v3 + v4 + v5;
  totalScoreEl.textContent = String(total);
  return { v1, v2, v3, v4, v5, total };
}

// recálculo ao digitar
[c1El, c2El, c3El, c4El, c5El].forEach(el => {
  el.addEventListener('input', () => calcularTotal());
});

// 🔹 CARREGAR REDAÇÕES DA TAREFA
async function carregarRedacoes() {
  try {
    const response = await fetch(`${API_URL}/essays/by-task/${taskId}/with-student`);
    if (!response.ok) throw new Error();

    const essays = await response.json();
    essaysList.innerHTML = '';

    if (!Array.isArray(essays) || essays.length === 0) {
      essaysList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';
      return;
    }

    essays.forEach(essay => {
      const li = document.createElement('li');

      const nome =
        essay.studentName && String(essay.studentName).trim()
          ? essay.studentName
          : 'Aluno não identificado';

      const statusNota =
        essay.score !== null && essay.score !== undefined ? `Nota: ${essay.score}` : 'Sem correção';

      li.textContent = `${nome} — ${statusNota}`;

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

  studentNameEl.textContent =
    essay.studentName && String(essay.studentName).trim()
      ? essay.studentName
      : 'Aluno não identificado';

  studentEmailEl.textContent =
    essay.studentEmail && String(essay.studentEmail).trim()
      ? essay.studentEmail
      : '(e-mail indisponível)';

  essayContentEl.textContent = essay.content || '';

  feedbackEl.value = essay.feedback || '';

  // ✅ Preenche competências se já houver correção
  c1El.value = essay.c1 ?? '';
  c2El.value = essay.c2 ?? '';
  c3El.value = essay.c3 ?? '';
  c4El.value = essay.c4 ?? '';
  c5El.value = essay.c5 ?? '';
  calcularTotal();

  correctionSection.style.display = 'block';
  statusEl.textContent = '';
}

// 🔹 SALVAR CORREÇÃO
saveBtn.addEventListener('click', async () => {
  if (!currentEssayId) {
    statusEl.textContent = 'Selecione uma redação primeiro.';
    return;
  }

  const feedback = feedbackEl.value.trim();
  const totalObj = calcularTotal();

  if (!feedback) {
    statusEl.textContent = 'Escreva o feedback.';
    return;
  }

  if (!totalObj) {
    statusEl.textContent = 'Preencha todas as competências (0 a 200).';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/${currentEssayId}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback,
        c1: totalObj.v1,
        c2: totalObj.v2,
        c3: totalObj.v3,
        c4: totalObj.v4,
        c5: totalObj.v5,
      }),
    });

    if (!response.ok) throw new Error();

    statusEl.textContent = 'Correção salva com sucesso!';
    carregarRedacoes();

  } catch {
    statusEl.textContent = 'Erro ao salvar correção.';
  }
});

// INIT
carregarRedacoes();
