let allQuestions = [];
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = {};      // { [questionId]: 'A' | 'B' | ... }
let flaggedQuestions = {}; // { [questionId]: true }
let timerInterval = null;
let secondsRemaining = 5 * 60 * 60; // 5 horas oficiais
let selectedLanguage = 'INGLES';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  setupUserData();
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

function setupEventListeners() {
  document.getElementById('btn-start-exam')?.addEventListener('click', startExam);
  document.getElementById('btn-prev-q')?.addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('btn-next-q')?.addEventListener('click', () => navigateQuestion(1));
  document.getElementById('btn-toggle-flag')?.addEventListener('click', toggleFlagCurrent);
  document.getElementById('btn-finish-exam')?.addEventListener('click', confirmFinishExam);
  document.getElementById('btn-finish-exam-top')?.addEventListener('click', confirmFinishExam);
}

async function startExam() {
  const langSelect = document.getElementById('start-lang-select');
  if (langSelect) selectedLanguage = langSelect.value;
  localStorage.setItem('foreignLanguage', selectedLanguage);

  const startBtn = document.getElementById('btn-start-exam');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = 'Carregando caderno de questões...';
  }

  try {
    // Busca as questões da API ou arquivo estruturado
    let res = null;
    try {
      res = await window.api.get('/simulations/current');
    } catch (e) {
      console.warn('Endpoint /simulations/current não encontrado. Usando base estruturada de contingência.');
    }

    // Se a API retornou questões
    if (res && res.questions && res.questions.length > 0) {
      allQuestions = res.questions;
    } else {
      // Carrega questões simuladas com a estrutura oficial UEMA
      allQuestions = generateOfficialUemaQuestions();
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
      startBtn.innerText = '⏱️ Iniciar Prova Oficial Agora';
    }
  }
}

// Filtra 60 questões exatas com base na opção de idioma
function filterLanguageQuestions() {
  activeQuestions = allQuestions.filter((q) => {
    const isEnglish = q.discipline?.toLowerCase().includes('ingl') || q.foreignLanguage === 'INGLES';
    const isSpanish = q.discipline?.toLowerCase().includes('espanh') || q.foreignLanguage === 'ESPANHOL';

    if (isEnglish) return selectedLanguage === 'INGLES';
    if (isSpanish) return selectedLanguage === 'ESPANHOL';
    return true; // Questões comuns de todas as outras disciplinas
  }).slice(0, 60);
}

// Cronômetro Regressivo
function startTimer() {
  const timerEl = document.getElementById('exam-timer');

  timerInterval = setInterval(() => {
    secondsRemaining--;

    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Tempo esgotado! Seu simulado será entregue automaticamente.');
      finishExam();
      return;
    }

    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');

    if (timerEl) {
      timerEl.innerText = `${h}:${m}:${s}`;
      if (secondsRemaining <= 1800) {
        timerEl.classList.add('timer-warning'); // Menos de 30 minutos
      }
    }
  }, 1000);
}

// Renderiza a Questão Atual
function renderCurrentQuestion() {
  if (!activeQuestions[currentIndex]) return;
  const q = activeQuestions[currentIndex];

  const metaEl = document.getElementById('q-discipline-topic');
  const progressEl = document.getElementById('exam-progress-text');
  const statementEl = document.getElementById('q-statement');
  const optionsEl = document.getElementById('options-container');
  const flagBtn = document.getElementById('btn-toggle-flag');
  const prevBtn = document.getElementById('btn-prev-q');
  const nextBtn = document.getElementById('btn-next-q');

  if (metaEl) metaEl.innerText = `${q.discipline || 'Geral'} • ${q.topic || 'Conhecimentos Gerais'}`;
  if (progressEl) progressEl.innerText = `Questão ${currentIndex + 1} de ${activeQuestions.length}`;
  if (statementEl) statementEl.innerHTML = (q.statement || '').replace(/\n/g, '<br>');

  // Flag
  const isFlagged = !!flaggedQuestions[q.id || currentIndex];
  if (flagBtn) {
    flagBtn.classList.toggle('active', isFlagged);
    flagBtn.innerText = isFlagged ? '🚩 Marcada para Revisão' : '🚩 Marcar para Revisar';
  }

  // Alternativas (A, B, C, D, E)
  const options = q.options || [
    { letter: 'A', text: q.optionA || 'Alternativa A' },
    { letter: 'B', text: q.optionB || 'Alternativa B' },
    { letter: 'C', text: q.optionC || 'Alternativa C' },
    { letter: 'D', text: q.optionD || 'Alternativa D' },
    { letter: 'E', text: q.optionE || 'Alternativa E' },
  ];

  const selected = userAnswers[q.id || currentIndex];

  if (optionsEl) {
    optionsEl.innerHTML = options
      .map(
        (opt) => `
      <div class="option-item ${selected === opt.letter ? 'selected' : ''}" onclick="selectOption('${opt.letter}')">
        <span class="option-letter">${opt.letter}</span>
        <span class="option-text">${opt.text}</span>
      </div>
    `,
      )
      .join('');
  }

  // Navegação
  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) {
    nextBtn.innerText = currentIndex === activeQuestions.length - 1 ? 'Revisar / Entregar' : 'Próxima ➡️';
  }

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

// Cartão-Resposta (OMR)
function renderOMR() {
  const grid = document.getElementById('omr-grid');
  const countEl = document.getElementById('omr-count');
  if (!grid) return;

  const answeredCount = Object.keys(userAnswers).length;
  if (countEl) countEl.innerText = `${answeredCount} de ${activeQuestions.length} respondidas`;

  grid.innerHTML = activeQuestions
    .map((q, idx) => {
      const qId = q.id || idx;
      const isAnswered = !!userAnswers[qId];
      const isFlagged = !!flaggedQuestions[qId];
      const isCurrent = idx === currentIndex;

      let classes = 'omr-btn';
      if (isAnswered) classes += ' answered';
      if (isFlagged) classes += ' flagged';
      if (isCurrent) classes += ' current';

      return `<button class="${classes}" onclick="jumpToQuestion(${idx})">${idx + 1}</button>`;
    })
    .join('');
}

function updateOMRStyles() {
  const buttons = document.querySelectorAll('.omr-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('current', idx === currentIndex);
  });
}

window.jumpToQuestion = (idx) => {
  currentIndex = idx;
  renderCurrentQuestion();
};

// Finalização da Prova
function confirmFinishExam() {
  const total = activeQuestions.length;
  const answered = Object.keys(userAnswers).length;
  const blank = total - answered;

  let msg = `Deseja realmente entregar o simulado agora?\n\n• Respondidas: ${answered}\n• Em branco: ${blank}`;
  if (blank > 0) {
    msg += '\n\nAtenção: questões em branco serão consideradas como incorretas.';
  }

  if (confirm(msg)) {
    finishExam();
  }
}

async function finishExam() {
  if (timerInterval) clearInterval(timerInterval);

  // Calcula acertos
  let correctCount = 0;
  activeQuestions.forEach((q, idx) => {
    const qId = q.id || idx;
    const correctLetter = q.correctAnswer || 'A';
    if (userAnswers[qId] === correctLetter) {
      correctCount++;
    }
  });

  // Envia resultado e atualiza liberação da redação
  try {
    await window.api.post('/simulations/submit', {
      answers: userAnswers,
      score: correctCount,
      totalQuestions: activeQuestions.length,
      foreignLanguage: selectedLanguage,
    });
  } catch (e) {
    console.warn('Submissão remota não disponível, registrando localmente no navegador:', e);
    // Salva liberação local para garantir o desbloqueio
    localStorage.setItem('simulation_completed', 'true');
    localStorage.setItem('simulation_score', String(correctCount));
  }

  // Exibe Tela de Resultado
  document.getElementById('exam-view').style.display = 'none';
  const resultView = document.getElementById('result-view');
  resultView.style.display = 'block';

  const scoreEl = document.getElementById('res-score');
  const percEl = document.getElementById('res-percentage');

  if (scoreEl) scoreEl.innerText = `${correctCount} / ${activeQuestions.length}`;
  if (percEl) {
    const perc = Math.round((correctCount / activeQuestions.length) * 100);
    percEl.innerText = `${perc}% de aproveitamento`;
  }
}

// Gerador da grade de 60 questões oficiais da UEMA (contingência)
function generateOfficialUemaQuestions() {
  const disciplines = [
    { name: 'Língua Portuguesa e Literatura', count: 15 },
    { name: 'Língua Inglesa', count: 5, lang: 'INGLES' },
    { name: 'Língua Espanhola', count: 5, lang: 'ESPANHOL' },
    { name: 'História', count: 8 },
    { name: 'Geografia', count: 8 },
    { name: 'Matemática', count: 8 },
    { name: 'Física', count: 7 },
    { name: 'Química', count: 7 },
    { name: 'Biologia', count: 7 },
  ];

  const list = [];
  let id = 1;

  disciplines.forEach((d) => {
    for (let i = 1; i <= d.count; i++) {
      list.push({
        id: `q_${id}`,
        discipline: d.name,
        foreignLanguage: d.lang || null,
        topic: `Conteúdo Programático PAES UEMA`,
        statement: `Considere os conhecimentos fundamentais sobre ${d.name}. A respeito deste tópico nas provas da UEMA, assinale a opção correta:`,
        options: [
          { letter: 'A', text: 'Representa a perspectiva predominante e a interpretação crítica preconizada pela banca.' },
          { letter: 'B', text: 'Apresenta contradição lógica em relação aos dados históricos e literários consolidados.' },
          { letter: 'C', text: 'Limita-se a uma visão descritiva superficial sem fundamentação teórica.' },
          { letter: 'D', text: 'Incorre em anacronismo conceitual ao comparar os períodos avaliados.' },
          { letter: 'E', text: 'Desconsidera o contexto sociocultural da produção científica e artística maranhense.' },
        ],
        correctAnswer: 'A',
      });
      id++;
    }
  });

  return list;
}
