const API_URL = 'http://localhost:3000';

// ID do professor (depois vem do login)
const teacherId = 'ID_DO_PROFESSOR';

async function loadEssays() {
  const roomId = document.getElementById('roomId').value;
  if (!roomId) {
    alert('Informe o ID da sala.');
    return;
  }

  const response = await fetch(`${API_URL}/essays/room?roomId=${roomId}`);
  const essays = await response.json();

  const essayArea = document.getElementById('essayArea');
  essayArea.innerHTML = '';

  essays
    .filter(e => e.status === 'submitted')
    .forEach(essay => {
      essayArea.innerHTML += renderEssay(essay);
    });
}

function renderEssay(essay) {
  return `
  <div class="section">
    <h3>Redação do Estudante: ${essay.studentId}</h3>

    <textarea readonly>${essay.text}</textarea>

    <h4>Competências ENEM (0–200)</h4>

    ${competencyInput('c1', 'Competência 1 – Norma culta')}
    ${competencyInput('c2', 'Competência 2 – Tema')}
    ${competencyInput('c3', 'Competência 3 – Argumentação')}
    ${competencyInput('c4', 'Competência 4 – Coesão')}
    ${competencyInput('c5', 'Competência 5 – Intervenção')}

    <h4>Feedback geral</h4>
    <textarea id="feedback-${essay.id}"></textarea>

    <button onclick="sendCorrection('${essay.id}')">
      Enviar correção
    </button>
  </div>
  `;
}

function competencyInput(key, label) {
  return `
    <label>${label}</label>
    <input type="number" id="${key}" min="0" max="200" />
  `;
}

async function sendCorrection(essayId) {
  const competencies = {
    c1: Number(document.getElementById('c1').value),
    c2: Number(document.getElementById('c2').value),
    c3: Number(document.getElementById('c3').value),
    c4: Number(document.getElementById('c4').value),
    c5: Number(document.getElementById('c5').value),
  };

  const feedbackGeneral =
    document.getElementById(`feedback-${essayId}`).value;

  const response = await fetch(`${API_URL}/essays/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      essayId,
      teacherId,
      competencies,
      feedbackGeneral,
    }),
  });

  const result = await response.json();

  if (result.error) {
    alert(result.error);
  } else {
    alert(`Correção enviada! Nota: ${result.totalScore}`);
  }
}
