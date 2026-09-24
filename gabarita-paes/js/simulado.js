const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}const CURRENT_CYCLE = {
  cycleCode: '2026-TESTE-21D',
  title: 'Simulado Oficial PAES UEMA (Ciclo 21 Dias)',
  startDate: '2026-09-09T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  durationDays: 21,
};

let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60;
let selectedLanguage = 'INGLES';
let reviewFilter = 'WRONG';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

// Normaliza a língua estrangeira vinda do cadastro/perfil
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
      const langLabel = document.getElementById('user-selected-lang');
      const startSelect = document.getElementById('start-lang-select');

      if (userHeader) userHeader.innerText = name.split(' ')[0];
      if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();
      if (langLabel) langLabel.innerText = selectedLanguage === 'ESPANHOL' ? 'Espanhol' : 'Inglês';
      if (startSelect) startSelect.value = selectedLanguage;
    }
  } catch (e) {
    console.error(e);
  }
}

// Bloqueio de Tentativa Única
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {}

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento`;

    document.getElementById('btn-view-review')?.addEventListener('click', async () => {
      await ensureQuestionsLoaded();
      openReviewFromSaved(savedData);
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
}

// Garante que o caderno com as explicações reais esteja na memória
async function ensureQuestionsLoaded() {
  if (allQuestions.length > 0) return;

  try {
    const jsonRes = await fetch('dados-simulado-uema-65q.json');
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      allQuestions = data.questions || [];
    }
  } catch (e) {}

  if (allQuestions.length === 0) {
    try {
      const res = await window.api.get('/simulations/current');
      if (res && res.questions) allQuestions = res.questions;
    } catch (e) {}
  }

  filterLanguageQuestions();
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = normalizeLanguage(langSelect.value);
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    await ensureQuestionsLoaded();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao carregar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtro estrito: seleciona exatamente as 60 questões (5 da língua escolhida e 55 comuns)
function filterLanguageQuestions() {
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

    // Questão comum regular de outras matérias (ex: História, Matemática)
    return true;
  });
}

function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial esgotado! Entregando prova...');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
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

function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja finalizar o Simulado Oficial?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}\n\nLembre-se: Este ciclo possui tentativa única.`;
  if (confirm(msg)) {
    finishExam();
  }
}

// Finalização e Armazenamento da Tentativa Única
async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  let correctCount = 0;
  const areas = {
    'Linguagens': { correct: 0, total: 0 },
    'Ciências Humanas': { correct: 0, total: 0 },
    'Ciências da Natureza': { correct: 0, total: 0 },
    'Matemática': { correct: 0, total: 0 },
  };

  activeQuestions.forEach((q, idx) => {
    const qKey = q.id || q.order || idx;
    const userChoice = userAnswers[qKey];

    let correctLetter = 'A';
    if (q.options && Array.isArray(q.options)) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) correctLetter = correctOpt.letter;
    } else if (q.correctAnswer) {
      correctLetter = q.correctAnswer;
    }
    q.officialAnswer = correctLetter;

    const isCorrect = userChoice === correctLetter;
    if (isCorrect) correctCount++;

    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('estrangeira') || disc.includes('ingl') || disc.includes('espanh')) {
      areaKey = 'Linguagens';
    } else if (disc.includes('físic') || disc.includes('químic') || disc.includes('biolog')) {
      areaKey = 'Ciências da Natureza';
    } else if (disc.includes('matemát')) {
      areaKey = 'Matemática';
    }

    if (areas[areaKey]) {
      areas[areaKey].total++;
      if (isCorrect) areas[areaKey].correct++;
    }
  });

  const submissionData = {
    cycleCode: CURRENT_CYCLE.cycleCode,
    submittedAt: new Date().toISOString(),
    score: correctCount,
    totalQuestions: activeQuestions.length,
    userAnswers,
    areas,
    questions: activeQuestions,
  };

  localStorage.setItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`, JSON.stringify(submissionData));

  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {}

  displayResult(submissionData);
}

function displayResult(data) {
  document.getElementById('exam-view').style.display = 'none';
  document.getElementById('intro-view').style.display = 'none';
  const resView = document.getElementById('result-view');
  resView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');
  const total = data.totalQuestions || 60;
  const score = data.score || 0;

  if (scoreEl) scoreEl.innerText = `${score} / ${total} Acertos`;
  if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de aproveitamento geral`;

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
    if (!correctChoice) correctChoice = q.correctAnswer || 'A';

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
        <p>Você demonstrou excelente aproveitamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendação de conteúdo (Mestre Kira, YouTube e portais de referência)
      const recommendations = getTargetedRecommendations(q);

      // Resgata o texto oficial exato do arquivo JSON
      const explanationText = q.explanation || 'Resolução comentada oficial da banca PAES UEMA.';

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

        <!-- Gabarito Comentado Oficial do JSON -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.35rem;">💡 Gabarito Comentado Oficial da Banca:</strong>
          <p style="margin: 0; line-height: 1.65; color: #334155;">
            ${explanationText}
          </p>
        </div>

        <!-- Sugestões de Conteúdo e Vídeos Específicos -->
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

// Mapeador Especializado de Conteúdos (Mestre Kira + YouTube + Portais)
function getTargetedRecommendations(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';
  const topicLower = topic.toLowerCase();

  let webLink = 'https://www.mestrekira.com.br/';
  let webLabel = '🌐 Artigo no Mestre Kira';
  let ytQuery = `UEMA ${q.discipline} ${topic}`;
  let ytChannel = 'Videoaula Recomendada';
  let tip = `Reforce o conteúdo de ${topic} para dominar a interpretação exigida pela banca examinadora.`;

  // 1. Língua Portuguesa e Literatura (Foco no Mestre Kira)
  if (disc.includes('literat') || disc.includes('portug')) {
    if (topicLower.includes('lucy') || topicLower.includes('crônica')) {
      webLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      webLabel = '🌐 Análise: Crônicas de Lucy Teixeira (Mestre Kira)';
      ytQuery = 'Cronicas de Lucy Teixeira PAES UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória da UEMA: estude a perspectiva do narrador e a ambientação maranhense.';
    } else if (topicLower.includes('cordel') || topicLower.includes('cora')) {
      webLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      webLabel = '🌐 Análise: Meu Livro de Cordel (Mestre Kira)';
      ytQuery = 'Meu Livro de Cordel Cora Coralina UEMA';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: foco na valorização do saber popular, oralidade e identidade sertaneja.';
    } else if (topicLower.includes('infância') || topicLower.includes('graciliano')) {
      webLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      webLabel = '🌐 Análise: Infância de Graciliano Ramos (Mestre Kira)';
      ytQuery = 'Infancia Graciliano Ramos UEMA analise';
      ytChannel = 'YouTube • Análise Literária UEMA';
      tip = 'Obra obrigatória: atenção aos temas de autoritarismo patriarcal e descoberta da escrita.';
    } else {
      webLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      webLabel = '🌐 Guia Gramatical & Textual (Mestre Kira)';
      ytQuery = `Professor Noslen ${topic}`;
      ytChannel = 'YouTube • Professor Noslen';
      tip = 'Revise a articulação sintática e os recursos de coesão textual no padrão da UEMA.';
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
    tip = 'A UEMA valoriza ecologia, fisiologia e ciclos biogeoquímicos aplicados aos ecossistemas locais.';
  }
  // 4. Física
  else if (disc.includes('físic')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Conceitos no Brasil Escola';
    ytQuery = `Professor Boaro ${topic}`;
    ytChannel = 'YouTube • Prof. Boaro';
    tip = 'Atenção à análise gráfica e à correlação entre leis físicas e fenômenos do cotidiano.';
  }
  // 5. Química
  else if (disc.includes('químic')) {
    webLink = `https://mundoeducacao.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Resumo no Mundo Educação';
    ytQuery = `Cafe com Quimica Professor Michel ${topic}`;
    ytChannel = 'YouTube • Café com Química';
    tip = 'Reforce cálculos estequiométricos, propriedades das substâncias e química ambiental.';
  }
  // 6. História & Geografia
  else if (disc.includes('histór') || disc.includes('geograf')) {
    webLink = `https://brasilescola.uol.com.br/busca?q=${encodeURIComponent(topic)}`;
    webLabel = '🌐 Artigo Temático no Brasil Escola';
    ytQuery = disc.includes('histór') ? `Parabolica Pedro Renno ${topic}` : `JeanGrafia ${topic}`;
    ytChannel = disc.includes('histór') ? 'YouTube • Parabólica (Pedro Rennó)' : 'YouTube • Prof. JeanGrafia';
    tip = 'A banca costuma relacionar os processos históricos e geográficos nacionais com o Maranhão.';
  }
  // 7. Línguas Estrangeiras
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

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}
