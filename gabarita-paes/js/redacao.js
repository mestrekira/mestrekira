let promptsData = [];
let selectedPromptId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // Identificação do Usuário e Avatar
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const name = user?.name || user?.email?.split('@')[0] || 'Aluno';
      const userEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');

      if (userEl) userEl.innerText = name.split(' ')[0];
      if (avatarEl) avatarEl.innerText = name.charAt(0).toUpperCase();
    }
  } catch (e) {
    console.error('Erro ao ler dados do usuário:', e);
  }

  checkEssayStatus();
  setupSpeechRecognition();
  setupCounter();
});

async function checkEssayStatus() {
  const lockedView = document.getElementById('locked-view');
  const unlockedView = document.getElementById('unlocked-view');

  try {
    const res = await window.api.get('/essays/cycle-status');
    if (!res) return;

    if (!res.unlocked) {
      if (lockedView) lockedView.style.display = 'block';
      if (unlockedView) unlockedView.style.display = 'none';

      const lockMsg = document.getElementById('lock-message');
      if (lockMsg) lockMsg.innerText = res.message;

      if (res.reason === 'PREMIUM_REQUIRED') {
        const lockTitle = document.getElementById('lock-title');
        const lockAction = document.getElementById('lock-action');
        if (lockTitle) lockTitle.innerText = 'Recurso Exclusivo Premium';
        if (lockAction) {
          lockAction.innerHTML = `
            <a href="assinar.html" class="btn" style="background: var(--accent, #10b981);">⭐ Assinar Plano Premium</a>
          `;
        }
      }
      return;
    }

    if (lockedView) lockedView.style.display = 'none';
    if (unlockedView) unlockedView.style.display = 'block';

    promptsData = res.prompts || [];
    renderThemes();
  } catch (error) {
    if (lockedView) lockedView.style.display = 'block';
    if (unlockedView) unlockedView.style.display = 'none';
    const lockMsg = document.getElementById('lock-message');
    if (lockMsg) lockMsg.innerText = error.message || 'Erro ao consultar status da redação.';
  }
}

function renderThemes() {
  const container = document.getElementById('theme-selector');
  if (!container) return;

  container.innerHTML = promptsData
    .map(
      (p) => `
    <button class="btn ${p.id === selectedPromptId ? '' : 'btn-secondary'}" 
            onclick="selectTheme('${p.id}')">
      Tema ${p.themeNumber} ${p.isSubmitted ? `(Nota: ${Number(p.score || 0).toFixed(2)})` : '• Disponível'}
    </button>
  `,
    )
    .join('');

  if (promptsData.length > 0 && !selectedPromptId) {
    selectTheme(promptsData[0].id);
  }
}

window.selectTheme = (promptId) => {
  selectedPromptId = promptId;
  const prompt = promptsData.find((p) => p.id === promptId);
  if (!prompt) return;

  renderThemes();
  const themeTitle = document.getElementById('theme-title');
  const themeTexts = document.getElementById('theme-texts');
  if (themeTitle) themeTitle.innerText = `Tema ${prompt.themeNumber}: ${prompt.title}`;
  if (themeTexts) themeTexts.innerHTML = (prompt.motivationalTexts || '').replace(/\n/g, '<br>');

  const submitBtn = document.getElementById('btn-submit-essay');
  if (submitBtn) {
    if (prompt.isSubmitted) {
      submitBtn.disabled = true;
      submitBtn.innerText = '📝 Redação Já Enviada e Avaliada';
      submitBtn.style.background = 'var(--text-muted, #94a3b8)';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerText = '🚀 Enviar para Correção Inteligente';
      submitBtn.style.background = 'var(--primary, #2563eb)';
    }
  }
};

// Reconhecimento de Voz
function setupSpeechRecognition() {
  const btnMic = document.getElementById('btn-mic');
  const textarea = document.getElementById('essay-text');
  if (!btnMic || !textarea) return;

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    btnMic.style.display = 'none';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = false;

  let isRecording = false;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + ' ';
    }
    textarea.value += (textarea.value ? ' ' : '') + transcript.trim();
    textarea.dispatchEvent(new Event('input'));
  };

  recognition.onerror = () => stopRecording();

  btnMic.addEventListener('click', () => {
    if (!isRecording) {
      recognition.start();
      isRecording = true;
      btnMic.classList.add('recording');
      btnMic.innerText = '🔴 Gravando... (Clique para pausar)';
    } else {
      stopRecording();
    }
  });

  function stopRecording() {
    recognition.stop();
    isRecording = false;
    btnMic.classList.remove('recording');
    btnMic.innerText = '🎙️ Ditar Redação por Voz';
  }
}

function setupCounter() {
  const textarea = document.getElementById('essay-text');
  const countSpan = document.getElementById('char-count');
  const submitBtn = document.getElementById('btn-submit-essay');

  if (textarea && countSpan) {
    textarea.addEventListener('input', () => {
      countSpan.innerText = `${textarea.value.length} caracteres (mínimo de 200)`;
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitEssay);
  }
}

async function submitEssay() {
  const textarea = document.getElementById('essay-text');
  const content = textarea ? textarea.value : '';

  if (!selectedPromptId) {
    alert('Selecione uma proposta de tema primeiro.');
    return;
  }
  if (content.trim().length < 200) {
    alert('A sua redação precisa ter no mínimo 200 caracteres para ser avaliada pela banca.');
    return;
  }

  const btn = document.getElementById('btn-submit-essay');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ O Corretor Inteligente está analisando sua redação...';
    btn.style.background = '#475569';
  }

  try {
    const res = await window.api.post('/essays/submit', {
      promptId: selectedPromptId,
      content,
    });

    displayResult(res);

    // Atualiza o estado do botão para concluído
    if (btn) {
      btn.disabled = true;
      btn.innerText = '✅ Redação Avaliada com Sucesso!';
      btn.style.background = 'var(--accent, #10b981)';
    }

    // Atualiza os temas no topo para exibir a nota atualizada
    await checkEssayStatus();
  } catch (error) {
    alert(error.message || 'Erro ao enviar redação.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Enviar para Correção Inteligente';
      btn.style.background = 'var(--primary, #2563eb)';
    }
  }
}

function displayResult(res) {
  const card = document.getElementById('result-card');
  if (!card) return;
  card.style.display = 'block';

  const totalScore = Number(res.totalScore ?? res.total_score ?? 0).toFixed(2);
  const resTotal = document.getElementById('res-total');
  if (resTotal) {
    resTotal.innerText = `${totalScore} / 10.0`;
  }

  const fb = res.aiFeedback ?? res.ai_feedback ?? res.feedback ?? {};

  // 1. Título Obrigatório
  const titleBadge = document.getElementById('title-badge-container');
  if (titleBadge) {
    const hasTitle = fb.has_title ?? res.has_title ?? true;
    const titleAnalysis = fb.title_analysis || (hasTitle ? 'Título identificado na 1ª linha.' : 'Título ausente (-0,50 ponto).');
    titleBadge.innerHTML = hasTitle
      ? `<span class="badge-title badge-success">✓ ${titleAnalysis}</span>`
      : `<span class="badge-title badge-warning">⚠ ${titleAnalysis}</span>`;
  }

  // 2. Parecer Geral
  const resFeedback = document.getElementById('res-feedback');
  if (resFeedback) {
    resFeedback.innerText = fb.pedagogical_feedback || 'Redação avaliada de acordo com as diretrizes da banca examinadora.';
  }

  // 3. Critérios Analíticos
  const criteriaGrid = document.getElementById('criteria-grid');
  if (criteriaGrid) {
    const crit = res.criteria || {
      theme: res.critTheme ?? res.crit_theme ?? 0,
      cohesion: res.critCohesion ?? res.crit_cohesion ?? 0,
      coherence: res.critCoherence ?? res.crit_coherence ?? 0,
      genre: res.critGenre ?? res.crit_genre ?? 0,
      grammarNorm: res.critGrammarNorm ?? res.crit_grammar_norm ?? 0,
    };

    const details = fb.criteria_details || {};

    const items = [
      { num: 1, name: 'Atendimento ao Tema', score: crit.theme, det: details.theme },
      { num: 2, name: 'Coesão das Partes', score: crit.cohesion, det: details.cohesion },
      { num: 3, name: 'Coerência Argumentativa', score: crit.coherence, det: details.coherence },
      { num: 4, name: 'Tipo Textual & Título', score: crit.genre, det: details.genre },
      { num: 5, name: 'Norma Padrão da Língua', score: crit.grammarNorm, det: details.grammar_norm },
    ];

    criteriaGrid.innerHTML = items
      .map((item) => `
      <div class="criterion-box">
        <div class="criterion-header">
          <strong>${item.num}. ${item.name}</strong>
          <span style="font-weight: 700; color: var(--primary, #2563eb);">${Number(item.score ?? 0).toFixed(2)} / 2.00</span>
        </div>
        <p style="margin: 0; font-size: 0.875rem; color: #475569;">
          ${item.det?.diagnosis || 'Avaliação conforme os descritores oficiais.'}
        </p>
        ${item.det?.student_quote ? `<div class="student-quote">"${item.det.student_quote}"</div>` : ''}
        ${item.det?.tip ? `<div class="tip-box">💡 <strong>Como aprimorar:</strong> ${item.det.tip}</div>` : ''}
      </div>
    `)
      .join('');
  }

  // 4. Desvios Gramaticais
  const deviationsContainer = document.getElementById('deviations-container');
  const deviationsBody = document.getElementById('deviations-body');
  if (deviationsContainer && deviationsBody) {
    const list = fb.grammar_deviations || [];
    if (list.length > 0) {
      deviationsContainer.style.display = 'block';
      deviationsBody.innerHTML = list
        .map(
          (d) => `
        <tr>
          <td style="color: #b91c1c; font-style: italic;">"${d.original}"</td>
          <td style="color: #15803d; font-weight: 500;">"${d.correction}"</td>
          <td style="color: #475569;">${d.rule}</td>
        </tr>
      `,
        )
        .join('');
    } else {
      deviationsContainer.style.display = 'none';
    }
  }

  // 5. Repertório Sociocultural (Obras Obrigatórias)
  const repBox = document.getElementById('repertoire-box');
  const repContent = document.getElementById('repertoire-content');
  if (repBox && repContent && fb.uema_repertoire_connection) {
    const rep = fb.uema_repertoire_connection;
    repBox.style.display = 'block';
    repContent.innerHTML = `
      <strong>Obra Indicada:</strong> ${rep.book}<br>
      <strong>Aplicação Temática:</strong> ${rep.application}
    `;
  } else if (repBox) {
    repBox.style.display = 'none';
  }

  // 6. Pontos Fortes e Pontos de Atenção
  const strengthsList = document.getElementById('strengths-list');
  if (strengthsList) {
    const strengths = fb.strengths || ['Boa adequação discursiva'];
    strengthsList.innerHTML = strengths.map((s) => `<li>${s}</li>`).join('');
  }

  const weaknessesList = document.getElementById('weaknesses-list');
  if (weaknessesList) {
    const weaknesses = fb.weaknesses || ['Aprofundar a fundamentação com dados ou citações'];
    weaknessesList.innerHTML = weaknesses.map((w) => `<li>${w}</li>`).join('');
  }

  // 7. Recomendações de Estudo
  const recBox = document.getElementById('recommendations-box');
  const recList = document.getElementById('recommendations-list');
  if (recBox && recList) {
    const recs = fb.study_recommendations || [];
    if (recs.length > 0) {
      recBox.style.display = 'block';
      recList.innerHTML = recs.map((r) => `<li>${r}</li>`).join('');
    } else {
      recBox.style.display = 'none';
    }
  }

  card.scrollIntoView({ behavior: 'smooth' });
}
