let promptsData = [];
let selectedPromptId = null;

document.addEventListener('DOMContentLoaded', () => {
  
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        const userEl = document.getElementById('user-name');
        if (userEl) userEl.innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (e) {
    console.error(e);
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
            <a href="assinar.html" class="btn" style="background: var(--accent);">⭐ Assinar Plano Premium</a>
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
      Tema ${p.themeNumber} ${p.isSubmitted ? `(Nota: ${p.score})` : '• Disponível'}
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
      submitBtn.innerText = 'Redação Já Enviada';
      submitBtn.style.background = 'var(--text-muted)';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerText = '🚀 Enviar para Correção com IA';
      submitBtn.style.background = 'var(--primary)';
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

  recognition.onerror = () => {
    stopRecording();
  };

  btnMic.addEventListener('click', () => {
    if (!isRecording) {
      recognition.start();
      isRecording = true;
      btnMic.classList.add('recording');
      btnMic.innerText = '🔴 Gravando... Fale pausadamente (Clique para pausar)';
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
    alert('Selecione um tema primeiro.');
    return;
  }
  if (content.trim().length < 200) {
    alert('A sua redação precisa ter no mínimo 200 caracteres para ser avaliada.');
    return;
  }

  const btn = document.getElementById('btn-submit-essay');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ A IA do PAES UEMA está corrigindo sua redação...';
  }

  try {
    const res = await window.api.post('/essays/submit', {
      promptId: selectedPromptId,
      content,
    });

    displayResult(res);
    checkEssayStatus();
  } catch (error) {
    alert(error.message || 'Erro ao enviar redação.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Enviar para Correção com IA';
    }
  }
}

function displayResult(res) {
  const card = document.getElementById('result-card');
  if (!card) return;
  card.style.display = 'block';

  const resTotal = document.getElementById('res-total');
  if (resTotal) {
    resTotal.innerText = `${Number(res.totalScore ?? 0).toFixed(2)} / 10.0`;
  }

  const criteriaGrid = document.getElementById('criteria-grid');
  if (criteriaGrid) {
    criteriaGrid.innerHTML = `
      <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
        <strong>Tema e Tipologia:</strong><br>${Number(res.criteria?.themeGenre ?? 0).toFixed(2)} / 2.50
      </div>
      <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
        <strong>Coerência e Argumentação:</strong><br>${Number(res.criteria?.coherence ?? 0).toFixed(2)} / 2.50
      </div>
      <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
        <strong>Coesão Textual:</strong><br>${Number(res.criteria?.cohesion ?? 0).toFixed(2)} / 2.50
      </div>
      <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
        <strong>Norma Padrão:</strong><br>${Number(res.criteria?.grammarNorm ?? 0).toFixed(2)} / 2.50
      </div>
    `;
  }

  const resFeedback = document.getElementById('res-feedback');
  if (resFeedback) {
    resFeedback.innerText = res.feedback?.pedagogical_feedback || 'Redação corrigida com sucesso.';
  }
  card.scrollIntoView({ behavior: 'smooth' });
}
