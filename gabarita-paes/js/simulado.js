// ================= CONFIGURAÇÃO DO CICLO E ACESSO =================
const SYSTEM_CONFIG = {
  isTestMode: true, // Em fase de testes: liberado para todos. Mude para false em produção para exigir plano Premium!
};

const CURRENT_CYCLE = {
  cycleCode: '',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: null,
  endDate: null,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60; // 5 horas para modo completo
let secondsElapsed = 0;             // cronômetro progressivo para treino
let selectedLanguage = 'INGLES';
let examMode = 'FULL';              // 'FULL' (Oficial 60Q) ou 'PRACTICE' (Treino Livre)
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // Verificação de Acesso (Assinantes vs Fase de Testes)
  if (!checkAccessPermission()) return;

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Checagem de Assinante (Premium Gate)
function checkAccessPermission() {
  if (SYSTEM_CONFIG.isTestMode) return true;

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isPremium = !!user.isPremium || user.planTier === 'PREMIUM';
    if (!isPremium) {
      document.getElementById('intro-view').style.display = 'none';
      document.getElementById('premium-gate-view').style.display = 'block';
      return false;
    }
  } catch (e) {}
  return true;
}

// Normaliza Língua Estrangeira
function normalizeLanguage(lang) {
  if (!lang) return 'INGLES';
  const str = String(lang).toLowerCase().trim();
  if (str.includes('esp')) return 'ESPANHOL';
  return 'INGLES';
}

function setupUserData() {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const name = user.name || user.email?.split('@')[0] || 'Aluno';
      const rawLang = user.foreignLanguage || user.language || localStorage.getItem('foreignLanguage') || 'INGLES';
      selectedLanguage = normalizeLanguage(rawLang);

      const userHeader = document.getElementById('user-name-header');
      const avatarHeader = document.getElementById('user-avatar-header');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Alternância entre as Duas Modalidades
window.setExamMode = (mode) => {
  examMode = mode;
  document.getElementById('card-mode-full')?.classList.toggle('active', mode === 'FULL');
  document.getElementById('card-mode-practice')?.classList.toggle('active', mode === 'PRACTICE');

  const practiceBox = document.getElementById('practice-discipline-box');
  if (practiceBox) {
    practiceBox.style.display = mode === 'PRACTICE' ? 'block' : 'none';
  }

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.innerText = mode === 'FULL' ? '⏱️ Iniciar Prova Oficial (5 Horas)' : '🎯 Iniciar Treino Livre';
  }
};

function updateCycleDate() {
  const date = CURRENT_CYCLE.endDate
    ? new Date(CURRENT_CYCLE.endDate).toLocaleDateString('pt-BR') : '';
  const label = date ? `Ciclo ${CURRENT_CYCLE.cycleCode} • até ${date}` : `Ciclo ${CURRENT_CYCLE.cycleCode}`;
  const intro = document.getElementById('cycle-date');
  const result = document.getElementById('result-subtitle');
  if (intro) intro.textContent = label;
  if (result) result.textContent = label;
}

// Verificação de Tentativa Única no Ciclo (para a Prova Completa)
async function checkCycleSubmissionStatus() {
  let isSubmitted = false;
  let savedData = null;

  try {
    const res = await window.api.get('/simulations/my-status');
    if (res) {
      CURRENT_CYCLE.cycleCode = res.cycleCode;
      CURRENT_CYCLE.endDate = res.endDate;
      updateCycleDate();
    }
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    const warnBox = document.getElementById('already-submitted-warning');
    if (warnBox) warnBox.style.display = 'block';

    const fullCard = document.getElementById('card-mode-full');
    if (fullCard) {
      fullCard.style.opacity = '0.6';
      fullCard.title = 'Simulado completo já realizado neste ciclo.';
    }
    setExamMode('PRACTICE');

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      const review = await window.api.get(`/simulations/review?cycle=${encodeURIComponent(savedData.cycleCode)}`);
      const userAnswers = Object.fromEntries(review.questions.map((q) => [q.id, q.selectedLetter]));
      openReviewFromSaved({ ...savedData, questions: review.questions, areas: review.areas, userAnswers });
    });
  }
}

function setupEventListeners() {
  document.getElementById('btn-start-exam')?.addEventListener('click', startExam);
  document.getElementById('btn-prev-q')?.addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('btn-next-q')?.addEventListener('click', () => navigateQuestion(1));
  document.getElementById('btn-toggle-flag')?.addEventListener('click', toggleFlagCurrent);
  document.getElementById('btn-finish-exam')?.addEventListener('click', confirmFinishExam);
  document.getElementById('btn-finish-exam-top')?.addEventListener('click', confirmFinishExam);
  document.getElementById('btn-generate-ai-plan')?.addEventListener('click', generateAiStudyPlan);
}

// Carregamento dos dados
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  const res = await window.api.get('/simulations/current');
  if (!res || !Array.isArray(res.questions) || !res.questions.length) {
    throw new Error('O caderno de questões não está disponível.');
  }
  CURRENT_CYCLE.cycleCode = res.cycleCode;
  CURRENT_CYCLE.title = res.title;
  CURRENT_CYCLE.endDate = res.endDate;
  updateCycleDate();
  allQuestions = res.questions;

}

// Início do Simulado / Treino
async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (selectedLanguage !== normalizeLanguage(user.foreignLanguage)) {
    alert('Altere a língua estrangeira no seu perfil antes de iniciar o simulado.');
    return;
  }

  if (examMode === 'FULL') {
    const status = await window.api.get('/simulations/my-status');
    if (status.submitted) {
      alert('Você já realizou o Simulado Oficial Completo neste ciclo.\nUtilize a opção de Treino por Disciplina para praticar!');
      setExamMode('PRACTICE');
      return;
    }
  }

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de questões...';
  }

  try {
    await ensureQuestionsLoaded();

    if (examMode === 'FULL') {
      filterFullExamQuestions();
      document.getElementById('exam-title-bar').innerText = 'PAES UEMA - Simulado Oficial (60 Questões)';
      startCountDownTimer();
    } else {
      filterPracticeQuestions();
      document.getElementById('exam-title-bar').innerText = 'PAES UEMA - Treino Livre por Disciplina';
      startCountUpTimer();
    }

    if (activeQuestions.length === 0) {
      alert('Nenhuma questão encontrada para os filtros selecionados.');
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerText = 'Iniciar Resolução';
      }
      return;
    }

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = 'Iniciar Resolução';
    }
  }
}

// Filtro Oficial: 60 questões (55 comuns + 5 da língua estrangeira oficial)
function filterFullExamQuestions() {
  const target = normalizeLanguage(selectedLanguage);

  activeQuestions = allQuestions.filter((q) => {
    const disc = (q.discipline || '').toLowerCase();
    const isForeignLang = disc.includes('estrangeira') || disc.startsWith('língua inglesa') || disc.startsWith('língua espanhola');

    if (isForeignLang) {
      const isEnglish = disc.includes('ingl');
      const isSpanish = disc.includes('espanh');
      if (isEnglish) return target === 'INGLES';
      if (isSpanish) return target === 'ESPANHOL';
      return false;
    }
    return true;
  });
}

// Filtro do Modo Treino Seletivo (com todas as 11 disciplinas)
function filterPracticeQuestions() {
  const checkboxes = document.querySelectorAll('input[name="disc-filter"]:checked');
  const selectedDiscs = Array.from(checkboxes).map((c) => c.value.toLowerCase());
  const targetLang = normalizeLanguage(selectedLanguage);

  activeQuestions = allQuestions.filter((q) => {
    const disc = (q.discipline || '').toLowerCase();
    const isForeignLang = disc.includes('estrangeira') || disc.startsWith('língua inglesa') || disc.startsWith('língua espanhola');

    if (isForeignLang) {
      if (!selectedDiscs.includes('estrangeira')) return false;
      const isEnglish = disc.includes('ingl');
      const isSpanish = disc.includes('espanh');
      if (isEnglish) return targetLang === 'INGLES';
      if (isSpanish) return targetLang === 'ESPANHOL';
      return false;
    }

    return selectedDiscs.some((d) => disc.includes(d));
  });
}

// Temporizador Regressivo de 5h para Prova Oficial
function startCountDownTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial de 5 horas esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
  }, 1000);
}

// Temporizador Progressivo para Modo Treino
function startCountUpTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsElapsed++;
    const h = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const s = String(secondsElapsed % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `⏱️ ${h}:${m}:${s}`;
  }, 1000);
}

function renderCurrentQuestion() {
  if (!activeQuestions[currentIndex]) return;
  const q = activeQuestions[currentIndex];

  const metaEl = document.getElementById('q-discipline-topic');
  const progressEl = document.getElementById('exam-progress-text');
  const statementEl = document.getElementById('q-statement');
  const imagesContainer = document.getElementById('q-images-container');
  const optionsEl = document.getElementById('options-container');
  const flagBtn = document.getElementById('btn-toggle-flag');
  const prevBtn = document.getElementById('btn-prev-q');
  const nextBtn = document.getElementById('btn-next-q');

  if (metaEl) metaEl.innerText = `${q.discipline || 'Geral'} • ${q.topic || 'Conhecimentos Gerais'}`;
  if (progressEl) progressEl.innerText = `Questão ${currentIndex + 1} de ${activeQuestions.length}`;
  if (statementEl) statementEl.innerHTML = (q.statement || '').replace(/\n/g, '<br>');

  if (imagesContainer) {
    const images = [];
    if (q.imageUrl) images.push({ url: q.imageUrl, label: q.imageUrlB ? 'Figura 1' : 'Figura da Questão' });
    if (q.imageUrlB) images.push({ url: q.imageUrlB, label: 'Figura 2' });
    if (q.image && !q.imageUrl) images.push({ url: q.image, label: 'Figura da Questão' });

    if (images.length > 0) {
      imagesContainer.style.display = 'block';
      imagesContainer.innerHTML = images
        .map((img) => `
        <div class="question-image-box">
          <img src="${img.url}" alt="${img.label}" class="question-image" loading="lazy" onclick="window.open('${img.url}', '_blank')">
          <div class="question-image-caption">🔍 ${img.label} (clique para ampliar)</div>
        </div>
      `).join('');
    } else {
      imagesContainer.style.display = 'none';
      imagesContainer.innerHTML = '';
    }
  }

  const isFlagged = !!flaggedQuestions[q.id || q.order || currentIndex];
  if (flagBtn) {
    flagBtn.classList.toggle('active', isFlagged);
    flagBtn.innerText = isFlagged ? '🚩 Marcada para Revisão' : '🚩 Marcar para Revisar';
  }

  const options = q.options || [
    { letter: 'A', text: q.optionA || '' },
    { letter: 'B', text: q.optionB || '' },
    { letter: 'C', text: q.optionC || '' },
    { letter: 'D', text: q.optionD || '' },
    { letter: 'E', text: q.optionE || '' },
  ];

  const selected = userAnswers[q.id || q.order || currentIndex];
  if (optionsEl) {
    optionsEl.innerHTML = options
      .map((opt) => `
      <div class="option-item ${selected === opt.letter ? 'selected' : ''}" onclick="selectOption('${opt.letter}')">
        <span class="option-letter">${opt.letter}</span>
        <span class="option-text">${opt.text}</span>
      </div>
    `).join('');
  }

  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) nextBtn.innerText = currentIndex === activeQuestions.length - 1 ? 'Revisar / Entregar' : 'Próxima ➡️';

  updateOMRStyles();
}

window.selectOption = (letter) => {
  const q = activeQuestions[currentIndex];
  userAnswers[q.id || q.order || currentIndex] = letter;
  renderCurrentQuestion();
  renderOMR();
};

function navigateQuestion(step) {
  const next = currentIndex + step;
  if (next >= 0 && next < activeQuestions.length) {
    currentIndex = next;
    renderCurrentQuestion();
  } else if (next >= activeQuestions.length) {
    confirmFinishExam();
  }
}

function toggleFlagCurrent() {
  const q = activeQuestions[currentIndex];
  const qKey = q.id || q.order || currentIndex;
  flaggedQuestions[qKey] = !flaggedQuestions[qKey];
  renderCurrentQuestion();
  renderOMR();
}

function renderOMR() {
  const grid = document.getElementById('omr-grid');
  const countEl = document.getElementById('omr-count');
  if (!grid) return;

  const answeredCount = Object.keys(userAnswers).length;
  if (countEl) countEl.innerText = `${answeredCount} de ${activeQuestions.length} respondidas`;

  grid.innerHTML = activeQuestions
    .map((q, idx) => {
      const qKey = q.id || q.order || idx;
      const isAns = !!userAnswers[qKey];
      const isFlag = !!flaggedQuestions[qKey];
      let cls = 'omr-btn';
      if (isAns) cls += ' answered';
      if (isFlag) cls += ' flagged';
      if (idx === currentIndex) cls += ' current';
      return `<button class="${cls}" onclick="jumpToQuestion(${idx})">${idx + 1}</button>`;
    }).join('');
}

function updateOMRStyles() {
  document.querySelectorAll('.omr-btn').forEach((btn, idx) => {
    btn.classList.toggle('current', idx === currentIndex);
  });
}

window.jumpToQuestion = (idx) => {
  currentIndex = idx;
  renderCurrentQuestion();
};

// ================= ALERTA DE QUESTÕES PENDENTES =================
function confirmFinishExam() {
  const total = activeQuestions.length;
  const missingIndices = [];

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    if (!userAnswers[qKey]) {
      missingIndices.push(idx + 1);
    }
  });

  const blankCount = missingIndices.length;

  if (blankCount > 0) {
    const modal = document.getElementById('unanswered-modal');
    const textEl = document.getElementById('unanswered-modal-text');
    const cancelBtn = document.getElementById('btn-modal-cancel');
    const confirmBtn = document.getElementById('btn-modal-confirm');

    if (modal && textEl) {
      const missingList = missingIndices.slice(0, 15).join(', ') + (blankCount > 15 ? '...' : '');
      textEl.innerHTML = `
        Você ainda tem <strong>${blankCount} questão(ões) em branco</strong>:<br>
        <span style="font-family: monospace; color: #b45309; font-weight: 600;">Questões: ${missingList}</span><br><br>
        Deseja entregar agora ou prefere voltar para preenchê-las?
      `;

      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        jumpToQuestion(missingIndices[0] - 1);
      };

      confirmBtn.onclick = () => {
        modal.style.display = 'none';
        finishExam();
      };

      modal.style.display = 'flex';
      return;
    }
  }

  if (confirm(`Deseja entregar o simulado com todas as ${total} questões respondidas?`)) {
    finishExam();
  }
}

// Finalização da Prova
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  if (examMode === 'FULL') {
    try {
      const result = await window.api.post('/simulations/submit', {
        cycleCode: CURRENT_CYCLE.cycleCode,
        answers: userAnswers,
      });
      const review = await window.api.get(`/simulations/review?cycle=${encodeURIComponent(CURRENT_CYCLE.cycleCode)}`);
      const submissionData = {
        cycleCode: CURRENT_CYCLE.cycleCode,
        isOfficial: true,
        score: result.score,
        totalQuestions: result.totalQuestions,
        userAnswers,
        questions: review.questions,
        areas: review.areas,
      };
      localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));
      displayResult(submissionData);
    } catch (error) {
      alert(error.message || 'Não foi possível entregar o simulado. Suas respostas continuam nesta página.');
    }
    return;
  }
  try {
    const grade = await window.api.post('/simulations/practice/grade', {
      cycleCode: CURRENT_CYCLE.cycleCode, answers: userAnswers,
    });
    const byId = new Map(grade.questions.map((q) => [q.id, q]));
    const questions = activeQuestions.map((q) => ({
      ...q,
      officialAnswer: byId.get(q.id)?.officialAnswer || null,
      explanation: byId.get(q.id)?.explanation || q.explanation,
    }));
    const submissionData = {
      isOfficial: false,
      score: grade.score,
      totalQuestions: grade.totalQuestions,
      userAnswers,
      questions,
      areas: {},
    };
    displayResult(submissionData);
  } catch (error) {
    alert(error.message || 'Não foi possível corrigir o treino.');
  }
  return;

}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const titleEl = document.getElementById('result-title');
  const total = data.totalQuestions || activeQuestions.length || 60;
  const score = data.score || 0;

  if (titleEl) {
    titleEl.innerText = data.isOfficial ? 'Resultado Oficial do Simulado (60Q)' : 'Resultado do Treino Livre';
  }
  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

  const areasContainer = document.getElementById('areas-breakdown');
  if (areasContainer && data.areas) {
    areasContainer.innerHTML = Object.entries(data.areas)
      .map(([area, val]) => `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem;">
        <strong style="color: #1e293b; font-size: 0.85rem; display: block;">${area}</strong>
        <span style="font-size: 1.25rem; font-weight: 800; color: var(--primary, #2563eb);">
          ${val.correct} / ${val.total}
        </span>
      </div>
    `).join('');
  }

  renderReviewList(data);
}

window.filterReview = (type) => {
  reviewFilter = type;
  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  if (localSaved) {
    renderReviewList(JSON.parse(localSaved));
  } else {
    renderReviewList({ questions: activeQuestions, userAnswers });
  }
};

function renderReviewList(data) {
  const container = document.getElementById('review-list-container');
  const wrongBadge = document.getElementById('wrong-count-badge');
  const filterWrongBtn = document.getElementById('filter-wrong-btn');
  const filterAllBtn = document.getElementById('filter-all-btn');
  if (!container) return;

  const questions = (data.questions && data.questions.length > 0) ? data.questions : activeQuestions;
  const answers = data.userAnswers || userAnswers;

  let wrongCount = 0;
  const listToRender = [];

  questions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = answers[qKey] || 'EM BRANCO';

    let correctChoice = q.officialAnswer;
    if (!correctChoice && q.options) {
      const opt = q.options.find((o) => o.isCorrect);
      if (opt) correctChoice = opt.letter;
    }
    if (!correctChoice) correctChoice = q.correctAnswer || '—';

    const isCorrect = userChoice === correctChoice;
    if (!isCorrect) wrongCount++;

    if (reviewFilter === 'WRONG' && isCorrect) return;
    listToRender.push({ q, idx, userChoice, correctChoice, isCorrect });
  });

  if (wrongBadge) wrongBadge.innerText = String(wrongCount);

  if (filterWrongBtn && filterAllBtn) {
    filterWrongBtn.classList.toggle('btn-secondary', reviewFilter !== 'WRONG');
    filterAllBtn.classList.toggle('btn-secondary', reviewFilter !== 'ALL');
  }

  if (listToRender.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #166534; background: #f0fdf4; border-radius: 8px;">
        <h3>🎉 Parabéns! Nenhuma questão incorreta neste filtro.</h3>
        <p>Você demonstrou excelente domínio dos conteúdos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      const recommendations = getTargetedRecommendations(q);
      const explanationText = q.explanation || q.explanacion || 'Resolução comentada oficial da banca PAES UEMA.';

      return `
      <div class="${cardClass}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <strong style="color: #1e293b; font-size: 1.05rem;">Questão ${item.idx + 1} (${q.discipline || 'Geral'})</strong>
          <span style="font-weight: 700; font-size: 0.9rem; color: ${item.isCorrect ? '#166534' : '#b91c1c'};">${statusTitle}</span>
        </div>

        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem;">
          <strong>Conteúdo Cobrado:</strong> ${q.topic || 'Conhecimentos Gerais'}
        </p>

        <div style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin-bottom: 1rem;">
          ${(q.statement || '').replace(/\n/g, '<br>')}
        </div>

        ${q.imageUrl ? `
          <div style="text-align: center; margin: 0.75rem 0;">
            <img src="${q.imageUrl}" style="max-width: 100%; max-height: 280px; border-radius: 6px;" loading="lazy">
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 0.35rem; margin: 0.75rem 0;">
          <div class="ans-tag ${item.isCorrect ? 'ans-correct' : 'ans-wrong'}">
            <strong>Sua Marcação:</strong> Alternativa ${item.userChoice}
          </div>
          ${!item.isCorrect ? `
            <div class="ans-tag ans-correct">
              <strong>Gabarito Oficial da Banca:</strong> Alternativa ${item.correctChoice}
            </div>
          ` : ''}
        </div>

        <!-- Explicação Oficial (explanation / explanacion) -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Resolução Comentada Oficial (Banca UEMA):</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos -->
        <div class="study-box">
          <strong style="color: #1e40af; display: flex; align-items: center; gap: 0.35rem;">
            📚 Sugestões de Estudo & Videoaulas Recomendadas:
          </strong>
          <p style="margin: 0.25rem 0 0.5rem 0; color: #1e3a8a; font-size: 0.85rem;">
            ${recommendations.tip}
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem;">
            <a href="${recommendations.webLink}" target="_blank" class="study-link">
              ${recommendations.webLabel}
            </a>
            <a href="${recommendations.ytLink}" target="_blank" class="study-link">
              📺 ${recommendations.ytLabel}
            </a>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// Recomendações Base para Todas as 11 Disciplinas
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar o estilo de cobrança da UEMA.`;

  // 1. Língua Portuguesa e Literatura
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular e oralidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e infância.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos coesivos no padrão da UEMA.';
    }
  }
  // 2. Matemática
  else if (disc.includes('matemát')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Teoria & Exercícios no Brasil Escola';
    ytQuery = `Gis com Giz Matematica ${topic}`;
    ytChannel = 'YouTube • Gis com Giz Matemática';
    tip = 'Pratique a resolução passo a passo e a aplicação de fórmulas contextualizadas.';
  }
  // 3. Biologia
  else if (disc.includes('biolog')) {
    webLink = `https://www.todamateria.com.br/busca/?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo Teórico no Toda Matéria';
    ytQuery = `Biologia com Samuel Cunha ${topic}`;
    ytChannel = 'YouTube • Prof. Samuel Cunha';
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos dos ecossistemas maranhenses.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à leitura e interpretação gráfica dos fenômenos físicos.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Revise cálculos estequiométricos e química ambiental.';
  }
  // 6. História
  else if (disc.includes('histór')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = `Parabolica Pedro Renno ${topic}`;
    ytChannel = 'YouTube • Parabólica (Pedro Rennó)';
    tip = 'A banca costuma relacionar os processos nacionais com a história e a formação social do Maranhão.';
  }
  // 7. Geografia
  else if (disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = `JeanGrafia ${topic}`;
    ytChannel = 'YouTube • Prof. JeanGrafia';
    tip = 'Atenção ao relevo, bacias hidrográficas, vegetação e dinâmicas econômicas do Maranhão.';
  }
  // 8. Filosofia
  else if (disc.includes('filosof')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent('filosofia ' + topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Parabolica Pedro Renno Filosofia ${topic}`;
    ytChannel = 'YouTube • Parabólica (Filosofia)';
    tip = 'A UEMA cobra ética, política clássica (Platão e Aristóteles), contratualismo e iluminismo.';
  }
  // 9. Sociologia
  else if (disc.includes('sociolog')) {
    webLink = `https://www.todamateria.com.br/busca/?q=${encodeURIComponent('sociologia ' + topic)}`;
    webLabel = '🌐 Resumo no Toda Matéria';
    ytQuery = `Parabolica Pedro Renno Sociologia ${topic}`;
    ytChannel = 'YouTube • Parabólica (Sociologia)';
    tip = 'Foco nos clássicos (Durkheim, Weber, Marx), cidadania, desigualdade social e cultura.';
  }
  // 10. Artes
  else if (disc.includes('arte')) {
    webLink = `https://www.todamateria.com.br/busca/?q=${encodeURIComponent('artes ' + topic)}`;
    webLabel = '🌐 História da Arte no Toda Matéria';
    ytQuery = `Historia da Arte Vestibular ${topic}`;
    ytChannel = 'YouTube • Arte & Cultura';
    tip = 'Atenção às manifestações culturais maranhenses, modernismo brasileiro e vanguardas europeias.';
  }
  // 11. Línguas Estrangeiras
  else if (disc.includes('ingl') || disc.includes('espanh')) {
    webLink = `https://www.todamateria.com.br/busca/?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Gramática no Toda Matéria';
    ytQuery = disc.includes('ingl') ? `English in Brazil ${topic}` : `Espanhol para Brasileiros ${topic}`;
    ytChannel = disc.includes('ingl') ? 'YouTube • English in Brazil' : 'YouTube • Espanhol para Brasileiros';
    tip = 'Foque no reconhecimento de conectivos e na técnica de leitura instrumental.';
  }

  const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;
  const ytLabel = `${ytChannel}`;

  return { tip, webLink, webLabel, ytLink, ytLabel };
}

// ================= GERAÇÃO DE PLANO COM GEMINI IA =================
async function generateAiStudyPlan() {
  const btn = document.getElementById('btn-generate-ai-plan');
  const output = document.getElementById('ai-plan-output');

  const wrongQuestions = activeQuestions.filter((q, idx) => {
    const qKey = q.id || q.order || idx;
    const ans = userAnswers[qKey];
    let correct = q.officialAnswer;
    if (!correct && q.options) {
      const opt = q.options.find((o) => o.isCorrect);
      if (opt) correct = opt.letter;
    }
    return ans !== correct;
  });

  if (wrongQuestions.length === 0) {
    alert('Parabéns! Você não errou nenhuma questão neste caderno.');
    return;
  }

  const apiKey = ''; // Chaves de API não devem ser armazenadas no navegador.

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Consultando Gemini AI...';
  }
  if (output) {
    output.style.display = 'block';
    output.innerHTML = '<em>Analisando seus pontos fracos e estruturando plano focado no PAES UEMA...</em>';
  }

  const errorSummary = wrongQuestions.map((q, idx) => `${idx + 1}. [${q.discipline || 'Geral'}] Tema: ${q.topic || 'Geral'}`).join('\n');

  const prompt = `Você é o tutor especialista do "Gabarita PAES" (mestrekira.com.br), focado no vestibular da UEMA (Universidade Estadual do Maranhão).
O estudante acabou de concluir um simulado e errou as seguintes questões e tópicos:

${errorSummary}

Por favor, elabore um plano de estudos objetivo em tópicos (HTML formatado com <h4>, <ul>, <li>, <strong>) contendo:
1. 🎯 Diagnóstico dos pontos fracos mais críticos para a UEMA;
2. 📚 Roteiro de prioridade de estudo para os próximos dias (quais matérias atacar primeiro);
3. 💡 Recomendações práticas de estudo e canais educativos do YouTube recomendados (Professor Noslen, Gis com Giz, Samuel Cunha, Boaro, Parabólica Pedro Rennó, Café com Química) e artigos do Mestre Kira para Literatura (obras obrigatórias de Lucy Teixeira, Graciliano Ramos e Cora Coralina).

Seja direto, encorajador e prático.`;

  try {
    let resultText = '';

    if (apiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na API Gemini: ${res.status}`);
      }

      const data = await res.json();
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      resultText = generateLocalSmartPlan(wrongQuestions);
    }

    if (output) {
      output.innerHTML = `
        <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1.25rem;">
          ${resultText}
        </div>
      `;
    }
  } catch (err) {
    console.error('Falha Gemini:', err);
    if (output) {
      output.innerHTML = `
        <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1.25rem;">
          ${generateLocalSmartPlan(wrongQuestions)}
        </div>
      `;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🔄 Atualizar Roteiro com IA';
    }
  }
}

function generateLocalSmartPlan(wrongQuestions) {
  const countsByDisc = {};
  wrongQuestions.forEach((q) => {
    const d = q.discipline || 'Conhecimentos Gerais';
    countsByDisc[d] = (countsByDisc[d] || 0) + 1;
  });

  const sorted = Object.entries(countsByDisc).sort((a, b) => b - a);

  return `
    <h4 style="color: #1e40af; margin-top: 0;">🎯 Diagnóstico de Prioridades PAES UEMA:</h4>
    <p>Com base nos seus erros nesta sessão, priorize as seguintes disciplinas nos próximos 7 dias:</p>
    <ul>
      ${sorted.map(([disc, count]) => `<li><strong>${disc}</strong>:${count} questão(ões) para revisar.</li>`).join('')}
    </ul>
    <h4 style="color: #1e40af;">📚 Recomendações de Reta Final:</h4>
    <ul>
      <li><strong>Língua Portuguesa e Literatura:</strong> Revise as obras obrigatórias da UEMA (<em>Crônicas</em> de Lucy Teixeira, <em>Infância</em> de Graciliano Ramos e <em>Meu Livro de Cordel</em> de Cora Coralina) nos artigos do portal <a href="https://www.mestrekira.com.br" target="_blank" style="color: #1d4ed8; font-weight: 600;">Mestre Kira</a>.</li>
      <li><strong>Ciências Exatas:</strong> Pratique a resolução comentada dos exercícios nos canais <em>Gis com Giz</em> (Matemática), <em>Professor Boaro</em> (Física) e <em>Café com Química</em>.</li>
      <li><strong>Humanas (História, Geografia, Filosofia, Sociologia):</strong> Foque na contextualização maranhense com o canal <em>Parabólica</em> (Pedro Rennó).</li>
      <li><strong>Linguagens e Artes:</strong> Revise expressões culturais maranhenses e modernismo brasileiro.</li>
    </ul>
  `;
}

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}
