// Configuração Simplificada do Ciclo de 21 Dias
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
let reviewFilter = 'WRONG'; // 'WRONG' ou 'ALL'

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
  checkCycleSubmissionStatus();
  setupEventListeners();
});

function setupUserData() {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const name = user.name || user.email?.split('@')[0] || 'Aluno';
      selectedLanguage = user.foreignLanguage || localStorage.getItem('foreignLanguage') || 'INGLES';

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

// 1. Bloqueio de Tentativa Única: Verifica se já respondeu neste ciclo
async function checkCycleSubmissionStatus() {
  const notSubIntro = document.getElementById('not-submitted-intro');
  const alreadySubIntro = document.getElementById('already-submitted-intro');

  // Verifica tanto na API quanto no armazenamento local
  const localSaved = localStorage.getItem(`sim_submission_${CURRENT_CYCLE.cycleCode}`);
  let isSubmitted = !!localSaved;
  let savedData = localSaved ? JSON.parse(localSaved) : null;

  try {
    const res = await window.api.get(`/simulations/my-status?cycle=${CURRENT_CYCLE.cycleCode}`);
    if (res && res.submitted) {
      isSubmitted = true;
      savedData = res;
    }
  } catch (e) {
    // Modo offline/local
  }

  if (isSubmitted && savedData) {
    if (notSubIntro) notSubIntro.style.display = 'none';
    if (alreadySubIntro) alreadySubIntro.style.display = 'block';

    const scoreEl = document.getElementById('already-score');
    const percEl = document.getElementById('already-perc');
    const score = Number(savedData.score || 0);
    const total = Number(savedData.totalQuestions || 60);

    if (scoreEl) scoreEl.innerText = `${score} / ${total}`;
    if (percEl) percEl.innerText = `${Math.round((score / total) * 100)}% de acertos`;

    document.getElementById('btn-view-review')?.addEventListener('click', () => {
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

// Inicia a Prova Oficial
async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = langSelect.value;
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de 60 questões...';
  }

  try {
    // Carrega o arquivo JSON do simulado oficial
    let loaded = false;
    try {
      const jsonRes = await fetch('dados-simulado-uema-65q.json');
      if (jsonRes.ok) {
        const data = await jsonRes.json();
        allQuestions = data.questions || [];
        loaded = true;
      }
    } catch (e) {}

    if (!loaded || allQuestions.length === 0) {
      try {
        const res = await window.api.get('/simulations/current');
        if (res && res.questions) allQuestions = res.questions;
      } catch (e) {}
    }

    if (allQuestions.length === 0) {
      allQuestions = generateFallbackUemaQuestions();
    }

    filterLanguageQuestions();

    document.getElementById('intro-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'block';

    renderOMR();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    alert('Erro ao iniciar simulado: ' + err.message);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = '⏱️ Iniciar Simulado Oficial';
    }
  }
}

// Filtra 60 questões conforme o idioma
function filterLanguageQuestions() {
  activeQuestions = allQuestions.filter((q) => {
    const isEng = q.discipline?.toLowerCase().includes('ingl') || q.foreignLanguage === 'INGLES';
    const isEsp = q.discipline?.toLowerCase().includes('espanh') || q.foreignLanguage === 'ESPANHOL';
    if (isEng) return selectedLanguage === 'INGLES';
    if (isEsp) return selectedLanguage === 'ESPANHOL';
    return true;
  }).slice(0, 60);
}

// Cronômetro de 5 horas
function startTimer() {
  const timerEl = document.getElementById('exam-timer');
  timerInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo oficial de prova esgotado!');
      finishExam();
      return;
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
  }, 1000);
}

// Renderiza a questão com suporte total a figuras e textos
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

  // Processamento das figuras
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

  // Marcação
  const isFlagged = !!flaggedQuestions[q.id || currentIndex];
  if (flagBtn) {
    flagBtn.classList.toggle('active', isFlagged);
    flagBtn.innerText = isFlagged ? '🚩 Marcada para Revisão' : '🚩 Marcar para Revisar';
  }

  // Alternativas A a E
  const options = q.options || [
    { letter: 'A', text: q.optionA || '' },
    { letter: 'B', text: q.optionB || '' },
    { letter: 'C', text: q.optionC || '' },
    { letter: 'D', text: q.optionD || '' },
    { letter: 'E', text: q.optionE || '' },
  ];

  const selected = userAnswers[q.id || currentIndex];
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
  userAnswers[q.id || currentIndex] = letter;
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
  const qId = q.id || currentIndex;
  flaggedQuestions[qId] = !flaggedQuestions[qId];
  renderCurrentQuestion();
  renderOMR();
}

// Cartão-Resposta
function renderOMR() {
  const grid = document.getElementById('omr-grid');
  const countEl = document.getElementById('omr-count');
  if (!grid) return;

  const answeredCount = Object.keys(userAnswers).length;
  if (countEl) countEl.innerText = `${answeredCount} de ${activeQuestions.length} respondidas`;

  grid.innerHTML = activeQuestions
    .map((q, idx) => {
      const qId = q.id || idx;
      const isAns = !!userAnswers[qId];
      const isFlag = !!flaggedQuestions[qId];
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

// Finalização, Cálculo de Acertos e Gravação da Tentativa Única
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
    const qId = q.id || idx;
    const userChoice = userAnswers[qId];

    // Encontra a alternativa correta oficial
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

    // Agrupa por área
    const disc = (q.discipline || '').toLowerCase();
    let areaKey = 'Ciências Humanas';
    if (disc.includes('portug') || disc.includes('literat') || disc.includes('ingl') || disc.includes('espanh')) {
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

  // Salva no LocalStorage com a chave do ciclo atual (bloqueia refazer)
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

  // Envia para o backend se disponível
  try {
    await window.api.post('/simulations/submit', {
      cycleCode: CURRENT_CYCLE.cycleCode,
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      areas,
    });
  } catch (e) {
    console.warn('Backend offline ou endpoint em implementação, gravado localmente.');
  }

  displayResult(submissionData);
}

// Exibe a tela de resultado e monta o relatório de questões erradas
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

  // Detalhamento por Área
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

  // Monta a revisão detalhada das questões
  renderReviewList(data);
}

// Filtro de Questões (Todas vs Apenas Erradas)
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

  const questions = data.questions || activeQuestions;
  const answers = data.userAnswers || userAnswers;

  let wrongCount = 0;
  const listToRender = [];

  questions.forEach((q, idx) => {
    const qId = q.id || idx;
    const userChoice = answers[qId] || 'EM BRANCO';
    const correctChoice = q.officialAnswer || 'A';
    const isCorrect = userChoice === correctChoice;

    if (!isCorrect) wrongCount++;

    if (reviewFilter === 'WRONG' && isCorrect) return; // Oculta acertos quando filtrado por erradas
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
        <h3>🎉 Parabéns! Nenhuma questão errada neste filtro.</h3>
        <p>Você demonstrou excelente domínio dos conteúdos programáticos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listToRender
    .map((item) => {
      const q = item.q;
      const cardClass = item.isCorrect ? 'review-card correct' : 'review-card wrong';
      const statusTitle = item.isCorrect ? '✅ Questão Correta' : '❌ Questão Incorreta';

      // Recomendações pedagógicas para o Mestre Kira e YouTube
      const studyRecommendations = generateSmartStudyTips(q);

      return `
      <div class="${cardClass}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <strong style="color: #1e293b; font-size: 1.05rem;">Questão ${item.idx + 1} (${q.discipline || 'Geral'})</strong>
          <span style="font-weight: 700; font-size: 0.9rem; color: ${item.isCorrect ? '#166534' : '#b91c1c'};">${statusTitle}</span>
        </div>

        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem;">
          <strong>Tópico:</strong> ${q.topic || 'Conhecimentos Gerais'}
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
            <strong>Sua Resposta:</strong> Alternativa ${item.userChoice}
          </div>
          ${!item.isCorrect ? `
            <div class="ans-tag ans-correct">
              <strong>Gabarito Oficial da Banca:</strong> Alternativa ${item.correctChoice}
            </div>
          ` : ''}
        </div>

        <!-- Explicação / Gabarito Comentado -->
        <div class="explanation-box">
          <strong style="color: #1e293b; display: block; margin-bottom: 0.25rem;">💡 Gabarito Comentado da Banca:</strong>
          ${q.explanation || 'Resolução comentada baseada no padrão de respostas da UEMA.'}
        </div>

        <!-- Recomendações de Estudo (Mestre Kira + YouTube) -->
        <div class="study-box">
          <strong style="color: #1e40af; display: flex; align-items: center; gap: 0.35rem;">
            📚 Onde Estudar e Aprofundar este Conteúdo:
          </strong>
          <p style="margin: 0.25rem 0 0.5rem 0; color: #1e3a8a; font-size: 0.85rem;">
            ${studyRecommendations.advice}
          </p>
          <div>
            <a href="${studyRecommendations.mestreKiraLink}" target="_blank" class="study-link">
              🌐 Ler Análise no Mestre Kira
            </a>
            <a href="${studyRecommendations.youtubeLink}" target="_blank" class="study-link">
              📺 Videoaula no YouTube (${q.discipline})
            </a>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// Gera recomendações personalizadas com base no tópico da UEMA
function generateSmartStudyTips(q) {
  const disc = (q.discipline || '').toLowerCase();
  const topic = q.topic || q.discipline || 'PAES UEMA';

  let mestreKiraLink = 'https://www.mestrekira.com.br/';
  let advice = `Revise os conceitos fundamentais de ${topic} para não perder pontos em questões com enunciados interpretativos da UEMA.`;

  if (disc.includes('literat') || disc.includes('portug')) {
    if (topic.toLowerCase().includes('lucy') || topic.toLowerCase().includes('crônica')) {
      mestreKiraLink = 'https://www.mestrekira.com.br/analise-cronicas-lucy-teixeira-ceres-costa-fernandes-paes-uema-2027.html';
      advice = 'Leia o artigo detalhado das Crônicas de Lucy Teixeira no Mestre Kira para dominar a análise de personagens e lirismo.';
    } else if (topic.toLowerCase().includes('cordel') || topic.toLowerCase().includes('cora')) {
      mestreKiraLink = 'https://www.mestrekira.com.br/analise-meu-livro-de-cordel-cora-coralina-paes-uema-2027.html';
      advice = 'Consulte a análise de Meu Livro de Cordel de Cora Coralina com foco na oralidade sertaneja e na cultura popular.';
    } else if (topic.toLowerCase().includes('infância') || topic.toLowerCase().includes('graciliano')) {
      mestreKiraLink = 'https://www.mestrekira.com.br/analise-obra-infancia-graciliano-ramos-temas-redacao.html';
      advice = 'Revise a obra Infância de Graciliano Ramos e as temáticas de opressão familiar e formação psicológica.';
    } else {
      mestreKiraLink = 'https://www.mestrekira.com.br/redacao-nota-10-paes-uema-2027.html';
      advice = 'Pratique a identificação de teses, figuras de linguagem e coesão textual aplicadas aos gêneros do PAES.';
    }
  } else if (disc.includes('histór') || disc.includes('geograf')) {
    advice = 'A UEMA costuma cobrar História e Geografia do Maranhão articuladas aos contextos nacionais. Revise as fontes e mapas.';
  }

  const queryYT = encodeURIComponent(`UEMA ${q.discipline} ${topic}`);
  const youtubeLink = `https://www.youtube.com/results?search_query=${queryYT}`;

  return { advice, mestreKiraLink, youtubeLink };
}

function openReviewFromSaved(savedData) {
  document.getElementById('intro-view').style.display = 'none';
  displayResult(savedData);
}

// Fallback caso o JSON remoto falhe
function generateFallbackUemaQuestions() {
  return [
    {
      order: 1,
      discipline: 'Língua Portuguesa e Literatura',
      topic: 'Romantismo e Poesia Social',
      statement: 'Considere a estética romântica maranhense e a representação poética dos povos originários na obra de Gonçalves Dias:',
      options: [
        { letter: 'A', text: 'Idealização heroica do indígena como símbolo de identidade nacional.', isCorrect: true },
        { letter: 'B', text: 'Crítica realista à exploração econômica sem elementos líricos.', isCorrect: false },
        { letter: 'C', text: 'Linguagem experimental e quebra métrica das vanguardas.', isCorrect: false },
        { letter: 'D', text: 'Submissão cultural e perda das tradições orais.', isCorrect: false },
        { letter: 'E', text: 'Ironia e sarcasmo como traços da poesia indigenista.', isCorrect: false },
      ],
      explanation: 'Gonçalves Dias estabelece no Romantismo brasileiro a dignificação do indígena, personificado como herói nobre dotado de sentimentos e virtudes míticas.',
    },
  ];
}
