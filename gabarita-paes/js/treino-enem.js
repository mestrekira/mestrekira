let practiceQuestions = [];
let activeDiscipline = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        document.getElementById('user-name').innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (e) {}

  setupFilters();
  window.buscarNovasQuestoes();
});

window.buscarNovasQuestoes = async () => {
  const container = document.getElementById('practice-container');
  container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">Buscando questões inéditas no banco do ENEM...</div>`;

  try {
    const url = activeDiscipline
      ? `/questions/practice?discipline=${encodeURIComponent(activeDiscipline)}&limit=10`
      : '/questions/practice?limit=10';

    const questions = await window.api.get(url);

    if (!questions || questions.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 2.5rem;">
          <h3>🎉 Você respondeu todas as questões disponíveis desta matéria!</h3>
          <p style="color: var(--text-muted); margin: 1rem 0;">Deseja reiniciar seu histórico de respostas para treinar novamente?</p>
          <button class="btn" onclick="reiniciarHistorico()">Reiniciar Histórico de ${activeDiscipline || 'Geral'}</button>
        </div>
      `;
      return;
    }

    practiceQuestions = questions;
    renderPractice();
  } catch (error) {
    container.innerHTML = `
      <div class="card" style="color: var(--danger); text-align: center;">
        ${error.message || 'Erro ao carregar questões do ENEM.'}
      </div>
    `;
  }
};

function renderPractice() {
  const container = document.getElementById('practice-container');
  container.innerHTML = practiceQuestions
    .map(
      (q, idx) => `
    <div class="card" id="practice-card-${q.id}">
      <div class="question-header">
        <span class="badge">ENEM ${q.year} • ${q.discipline}</span>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${q.topic}</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Imagem da questão">` : ''}

      <div class="options-list" id="opts-${q.id}">
        ${q.options
          .map(
            (opt) => `
          <div class="option-item" onclick="selectPracticeOption('${q.id}', '${opt.id}')" id="opt-${opt.id}">
            <span class="option-letter">${opt.letter}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `,
          )
          .join('')}
      </div>

      <button class="btn" id="btn-submit-${q.id}" onclick="submitPracticeAnswer('${q.id}')">
        Responder e Conferir
      </button>

      <!-- Área de Feedback / Recomendações em caso de erro -->
      <div id="feedback-${q.id}" style="display: none; margin-top: 1rem;"></div>
    </div>
  `,
    )
    .join('');
}

window.practiceSelections = {};
window.selectPracticeOption = (questionId, optionId) => {
  const optsContainer = document.getElementById(`opts-${questionId}`);
  if (!optsContainer) return;

  optsContainer.querySelectorAll('.option-item').forEach((el) => el.classList.remove('selected'));
  const target = document.getElementById(`opt-${optionId}`);
  if (target) target.classList.add('selected');

  window.practiceSelections[questionId] = optionId;
};

window.submitPracticeAnswer = async (questionId) => {
  const selectedOptionId = window.practiceSelections[questionId];
  if (!selectedOptionId) {
    alert('Selecione uma alternativa antes de responder.');
    return;
  }

  const btn = document.getElementById(`btn-submit-${questionId}`);
  btn.disabled = true;
  btn.innerText = 'Corrigindo...';

  try {
    const res = await window.api.post('/questions/practice/answer', {
      questionId,
      selectedOptionId,
    });

    btn.style.display = 'none';

    // Pinta a alternativa correta de verde e a incorreta de vermelho
    const optsContainer = document.getElementById(`opts-${questionId}`);
    optsContainer.querySelectorAll('.option-item').forEach((optEl) => {
      optEl.onclick = null; // Trava cliques após responder
    });

    const correctEl = document.getElementById(`opt-${res.correctOptionId}`);
    if (correctEl) {
      correctEl.style.borderColor = 'var(--accent)';
      correctEl.style.background = '#f0fdf4';
    }

    if (!res.isCorrect) {
      const wrongEl = document.getElementById(`opt-${selectedOptionId}`);
      if (wrongEl) {
        wrongEl.style.borderColor = 'var(--danger)';
        wrongEl.style.background = '#fef2f2';
      }
    }

    // Exibe a explicação e recomendações
    const feedbackBox = document.getElementById(`feedback-${questionId}`);
    feedbackBox.style.display = 'block';

    let recsHtml = '';
    if (!res.isCorrect && res.recommendations && res.recommendations.length > 0) {
      recsHtml = `
        <div class="rec-box">
          <strong>💡 Recomendação de Estudo para este Assunto:</strong>
          ${res.recommendations
            .map(
              (r) => `
            <a href="${r.url}" target="_blank" class="rec-item">
              🔗 ${r.title}${r.sourceType === 'MESTRE_KIRA' ? '(Artigo Mestre Kira)' : '(Parceiro)'}
            </a>
          `,
            )
            .join('')}
        </div>
      `;
    }

    feedbackBox.innerHTML = `
      <div style="padding: 1rem; border-radius: 6px; background: ${res.isCorrect ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${res.isCorrect ? '#bbf7d0' : '#fecaca'};">
        <strong style="color: ${res.isCorrect ? '#166534' : '#991b1b'};">
          ${res.isCorrect ? '✅ Resposta Correta!' : `❌ Resposta Incorreta. A alternativa correta é a letra (${res.correctLetter}).`}
        </strong>
        ${res.explanation ? `<p style="margin-top: 0.5rem; color: #334155;"><strong>Resolução:</strong> ${res.explanation}</p>` : ''}
        ${recsHtml}
      </div>
    `;
  } catch (error) {
    alert(error.message || 'Erro ao enviar resposta.');
    btn.disabled = false;
    btn.innerText = 'Responder e Conferir';
  }
};

window.reiniciarHistorico = async () => {
  if (!confirm(`Deseja realmente reiniciar seu histórico de questões desta matéria?`)) return;

  try {
    await window.api.post('/questions/practice/reset-history', {
      discipline: activeDiscipline,
    });
    alert('Histórico reiniciado!');
    window.buscarNovasQuestoes();
  } catch (e) {
    alert(e.message || 'Erro ao reiniciar histórico.');
  }
};

function setupFilters() {
  const buttons = document.querySelectorAll('#disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiscipline = btn.getAttribute('data-discipline');
      window.buscarNovasQuestoes();
    });
  });
}
