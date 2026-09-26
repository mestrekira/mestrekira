function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// ================= CONFIGURAÇÃO DO CICLO E ACESSO =================
const SYSTEM_CONFIG = {
  isTestMode: true, // Exibição na fase de testes; o bloqueio real é PAES_PREMIUM_REQUIRED na API.
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
let examMode = 'FULL';              // Duas formas de resolver a mesma tentativa oficial
let reviewFilter = 'WRONG';
let reviewDiscipline = 'ALL';
let reviewData = null;
let aiStudyPlan = null;
let activeAttemptId = null;
let officialCompleted = false;
let pendingSave = Promise.resolve();

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
  if (officialCompleted) {
    alert('O simulado deste ciclo já foi concluído. Consulte a revisão.');
    return;
  }
  examMode = mode;
  document.getElementById('card-mode-full')?.classList.toggle('active', mode === 'FULL');
  document.getElementById('card-mode-practice')?.classList.toggle('active', mode === 'DISCIPLINE');

  const practiceBox = document.getElementById('practice-discipline-box');
  if (practiceBox) {
    practiceBox.style.display = mode === 'DISCIPLINE' ? 'block' : 'none';
  }

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.innerText = mode === 'FULL' ? '⏱️ Resolver as 60 questões' : '🎯 Resolver por disciplina';
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
  try {
    const res = await window.api.get('/simulations/my-status');
    if (!res) return;
    CURRENT_CYCLE.cycleCode = res.cycleCode;
    CURRENT_CYCLE.endDate = res.endDate;
    updateCycleDate();
    officialCompleted = !!res.submitted;
    const existing = await window.api.get(`/simulations/attempts/official/current?cycle=${encodeURIComponent(res.cycleCode)}`);
    if (officialCompleted) {
      const warnBox = document.getElementById('already-submitted-warning');
      if (warnBox) warnBox.style.display = 'block';
      const fullCard = document.getElementById('card-mode-full');
      if (fullCard) {
        fullCard.style.opacity = '0.6';
        fullCard.title = 'Prova oficial já concluída neste ciclo.';
      }
      const btn = document.getElementById('btn-start-exam');
      if (btn) btn.disabled = true;
      document.getElementById('btn-view-review')?.addEventListener('click', async () => {
        try {
          const review = existing?.attemptId
            ? await window.api.get(`/simulations/attempts/${existing.attemptId}/review`)
            : await window.api.get(`/simulations/review?cycle=${encodeURIComponent(res.cycleCode)}`);
          activeAttemptId = existing?.attemptId || null;
          openReviewFromSaved({ ...res, isOfficial: true, ...review,
            userAnswers: Object.fromEntries(review.questions.map((q) => [q.id, q.selectedLetter])) });
        } catch (error) { alert(error.message || 'Não foi possível abrir a revisão.'); }
      });
    } else if (existing?.status === 'IN_PROGRESS') {
      const btn = document.getElementById('btn-start-exam');
      if (btn) btn.innerText = 'Continuar simulado';
    }
  } catch (error) {
    console.error('Não foi possível carregar o status do simulado:', error);
  }
}

function setupEventListeners() {
  document.getElementById('btn-start-exam')?.addEventListener('click', startExam);
  document.getElementById('btn-change-discipline')?.addEventListener('click', async () => {
    try {
      await pendingSave;
      if (timerInterval) clearInterval(timerInterval);
      document.getElementById('exam-view').style.display = 'none';
      document.getElementById('intro-view').style.display = 'block';
      const btn = document.getElementById('btn-start-exam');
      if (btn) { btn.disabled = false; btn.innerText = 'Continuar por disciplina'; }
    } catch (error) { alert(error.message || 'Não foi possível salvar a resposta.'); }
  });
  document.getElementById('btn-prev-q')?.addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('btn-next-q')?.addEventListener('click', () => navigateQuestion(1));
  document.getElementById('btn-toggle-flag')?.addEventListener('click', toggleFlagCurrent);
  document.getElementById('btn-finish-exam')?.addEventListener('click', confirmFinishExam);
  document.getElementById('btn-finish-exam-top')?.addEventListener('click', confirmFinishExam);
  document.getElementById('btn-generate-ai-plan')?.addEventListener('click', generateAiStudyPlan);
  document.getElementById('review-discipline')?.addEventListener('change', (event) => {
    reviewDiscipline = event.target.value;
    if (reviewData) renderReviewList(reviewData);
  });
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

  if (officialCompleted) {
    alert('Você já realizou a prova oficial neste ciclo.');
    return;
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
      secondsRemaining = 5 * 60 * 60;
    } else {
      filterPracticeQuestions();
      document.getElementById('exam-title-bar').innerText = 'PAES UEMA - Simulado por Disciplina';
      secondsElapsed = 0;
    }

    if (activeQuestions.length === 0) {
      alert('Nenhuma questão encontrada para os filtros selecionados.');
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerText = 'Iniciar Resolução';
      }
      return;
    }

    const attempt = await window.api.post('/simulations/attempts', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      mode: 'OFFICIAL',
      resolutionMode: examMode,
    });
    activeAttemptId = attempt.attemptId;
    const eligible = new Set(attempt.questionIds);
    activeQuestions = activeQuestions.filter((q) => eligible.has(q.id));
    userAnswers = attempt.answers || {};
    currentIndex = 0;
    flaggedQuestions = {};
    document.getElementById('btn-change-discipline').style.display = examMode === 'DISCIPLINE' ? 'block' : 'none';
    if (timerInterval) clearInterval(timerInterval);
    if (examMode === 'FULL') {
      secondsRemaining = Math.max(0, 5 * 60 * 60 - Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
      startCountDownTimer();
    } else {
      startCountUpTimer();
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

  if (metaEl) metaEl.innerText = `${escapeHtml(q.discipline || 'Geral')} • ${escapeHtml(q.topic || 'Conhecimentos Gerais')}`;
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
  if (!q || !activeAttemptId) return;
  const attemptId = activeAttemptId;
  pendingSave = pendingSave.catch(() => {}).then(async () => {
    try {
      await window.api.post(`/simulations/attempts/${attemptId}/answers`, { questionId: q.id, letter });
      userAnswers[q.id] = letter;
      renderCurrentQuestion();
      renderOMR();
    } catch (error) {
      alert(error.message || 'A resposta não foi salva no banco. Tente novamente.');
      throw error;
    }
  });
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
  if (countEl) countEl.innerText = `${answeredCount} de 60 respondidas no simulado`;

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
  const allEligible = allQuestions.filter((q) => {
    const disc = (q.discipline || '').toLowerCase();
    if (!disc.includes('estrangeira') && !disc.startsWith('língua inglesa') && !disc.startsWith('língua espanhola')) return true;
    return normalizeLanguage(selectedLanguage) === (disc.includes('espanh') ? 'ESPANHOL' : 'INGLES');
  });
  const missing = allEligible.filter((q) => !userAnswers[q.id]);
  if (missing.length) {
    alert(`Faltam ${missing.length} de ${allEligible.length} questões. Suas respostas estão salvas no banco. ${examMode === 'DISCIPLINE' ? 'Escolha as demais disciplinas para continuar.' : 'Responda todas antes de entregar.'}`);
    return;
  }
  if (confirm(`Deseja entregar o simulado com todas as ${allEligible.length} questões respondidas?`)) finishExam();
}

// Finalização da Prova
async function finishExam() {
  if (!activeAttemptId) return;
  try {
    await pendingSave;
    const result = await window.api.post(`/simulations/attempts/${activeAttemptId}/finish`, {});
    if (timerInterval) clearInterval(timerInterval);
    if (result.submitted) officialCompleted = true;
    const review = await window.api.get(`/simulations/attempts/${activeAttemptId}/review`);
    displayResult({ ...result, ...review, isOfficial: result.submitted,
      userAnswers: Object.fromEntries(review.questions.map((q) => [q.id, q.selectedLetter])) });
  } catch (error) {
    alert(error.message || 'Não foi possível finalizar. As respostas salvas permanecem no banco.');
  }
}

function displayResult(data) {
  reviewData = data;
  const disciplineSelect = document.getElementById('review-discipline');
  if (disciplineSelect) {
    const disciplines = [...new Set((data.questions || []).map((q) => q.discipline))].sort();
    disciplineSelect.replaceChildren(new Option('Todas as disciplinas', 'ALL'),
      ...disciplines.map((d) => new Option(d, d)));
    reviewDiscipline = 'ALL';
  }
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
    titleEl.innerText = 'Resultado Oficial do Simulado';
  }
  const officialLinks = document.getElementById('official-result-links');
  if (officialLinks) officialLinks.style.display = 'flex';
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
  if (reviewData) renderReviewList(reviewData);
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
    if (!isCorrect && (reviewDiscipline === 'ALL' || q.discipline === reviewDiscipline)) wrongCount++;

    if (reviewFilter === 'WRONG' && isCorrect) return;
    if (reviewDiscipline !== 'ALL' && q.discipline !== reviewDiscipline) return;
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

      const match = aiStudyPlan?.priorities?.find((p) => p.discipline === q.discipline && p.topic === q.topic);
      const recommendations = getTargetedRecommendations(q);
      const explanationText = escapeHtml(q.explanation || q.explanacion || 'Explicação ainda não cadastrada.').replace(/\n/g, '<br>');

      return `
      <div class="${cardClass}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <strong style="color: #1e293b; font-size: 1.05rem;">Questão ${item.idx + 1} (${escapeHtml(q.discipline || 'Geral')})</strong>
          <span style="font-weight: 700; font-size: 0.9rem; color: ${item.isCorrect ? '#166534' : '#b91c1c'};">${statusTitle}</span>
        </div>

        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem;">
          <strong>Conteúdo Cobrado:</strong> ${escapeHtml(q.topic || 'Conhecimentos Gerais')}
        </p>

        <div style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin-bottom: 1rem;">
          ${escapeHtml(q.statement || '').replace(/\n/g, '<br>')}
        </div>

        ${q.imageUrl ? `
          <div style="text-align: center; margin: 0.75rem 0;">
            <img src="${q.imageUrl}" style="max-width: 100%; max-height: 280px; border-radius: 6px;" loading="lazy">
          </div>
        ` : ''}

        ${q.imageUrlB ? `<img src="${q.imageUrlB}" alt="Segunda figura da questão" style="max-width: 100%; max-height: 280px; border-radius: 6px;" loading="lazy">` : ''}
        ${q.options?.length ? `<ul style="margin: 0.75rem 0; padding-left: 1.5rem;">${q.options.map((opt) => `<li><strong>${escapeHtml(opt.letter)}.</strong> ${escapeHtml(opt.text)}</li>`).join('')}</ul>` : ''}
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

        <div class="study-box">
          <strong style="color: #1e40af;">📚 Materiais para revisão</strong>
          ${match ? `
            <p style="margin: 0.4rem 0;"><strong>Diagnóstico:</strong> ${escapeHtml(match.reason || '')}</p>
            <p style="margin: 0.4rem 0;"><strong>Próximo passo:</strong> ${escapeHtml(match.action)}</p>
            ${(match.resources || []).length ? `<div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
              ${match.resources.map((r) => `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="study-link">${r.kind === 'video' ? '📺' : '🌐'} ${escapeHtml(r.title)}</a>`).join('')}
            </div>` : '<p>Nenhum link específico foi confirmado para este tópico.</p>'}
          ` : `
            <p style="margin: 0.4rem 0;">Gere o roteiro com IA para receber links de páginas e videoaulas específicas. Enquanto isso:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
              <a href="${recommendations.webLink}" target="_blank" rel="noopener noreferrer" class="study-link">Pesquisar leitura sobre ${escapeHtml(q.topic || 'o tema')}</a>
              <a href="${recommendations.ytLink}" target="_blank" rel="noopener noreferrer" class="study-link">Pesquisar videoaula</a>
            </div>
          `}
        </div>
      </div>
    `;
    }).join('');
}

// Busca explícita como alternativa enquanto o roteiro com IA não for solicitado.
function getTargetedRecommendations(q) {
  const portuguese = /portug|literat|redaç|interpretaç/i.test(q.discipline || '');
  const topic = `${q.discipline || ''} ${q.topic || ''}`.trim();
  return {
    webLink: `https://www.google.com/search?q=${encodeURIComponent((portuguese ? 'site:mestrekira.com.br ' : 'site:brasilescola.uol.com.br OR site:todamateria.com.br ') + topic)}`,
    ytLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(`videoaula PAES UEMA ${topic}`)}`,
  };
}

// ================= GERAÇÃO DE PLANO COM GEMINI IA =================
async function generateAiStudyPlan() {
  const btn = document.getElementById('btn-generate-ai-plan');
  const output = document.getElementById('ai-plan-output');
  if (!activeAttemptId || !output) return;
  btn.disabled = true;
  output.style.display = 'block';
  output.textContent = 'Gerando roteiro de revisão...';
  try {
    const plan = await window.api.post(`/simulations/attempts/${activeAttemptId}/study-plan`, {});
    aiStudyPlan = plan;
    if (reviewData) renderReviewList(reviewData);
    output.replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = plan.summary;
    output.append(summary);
    const list = document.createElement('ul');
    for (const item of plan.priorities || []) {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${item.discipline} — ${item.topic} (${item.wrongCount} de ${item.total} questão(ões) deste conteúdo): `;
      li.append(title, document.createTextNode(`${item.reason || ''} ${item.action}`));
      for (const resource of item.resources || []) {
        const link = document.createElement('a');
        link.href = resource.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${resource.kind === 'video' ? ' 📺 ' : ' 🌐 '}${resource.title}${resource.channel ? ` — ${resource.channel}` : ''}`;
        li.append(link);
      }
      list.append(li);
    }
    output.append(list);
  } catch (error) {
    output.textContent = error.message || 'Não foi possível gerar o plano agora. Os materiais por questão continuam disponíveis abaixo.';
  } finally { btn.disabled = false; }
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
