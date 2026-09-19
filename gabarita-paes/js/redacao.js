let promptsData = [];
let selectedPromptId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // Exibe o nome do aluno no menu
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        document.getElementById('user-name').innerText = `👤 ${user.name.split(' ')[0]}`;
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
  try {
    const res = await window.api.get('/essays/cycle-status');
    if (!res) return;

    if (!res.unlocked) {
      document.getElementById('locked-view').style.display = 'block';
      document.getElementById('unlocked-view').style.display = 'none';
      document.getElementById('lock-message').innerText = res.message;

      // Se o bloqueio for por plano gratuito, oferece o botão de assinar
      if (res.reason === 'PREMIUM_REQUIRED') {
        document.getElementById('lock-title').innerText = 'Recurso Exclusivo Premium';
        document.getElementById('lock-action').innerHTML = `
          <a href="assinar.html" class="btn" style="background: var(--accent);">⭐ Assinar Plano Premium</a>
        `;
      }
      return;
    }

    document.getElementById('locked-view').style.display = 'none';
    document.getElementById('unlocked-view').style.display = 'block';

    promptsData = res.prompts;
    renderThemes();
  } catch (error) {
    document.getElementById('locked-view').style.display = 'block';
    document.getElementById('lock-message').innerText = error.message || 'Erro ao consultar status da redação.';
  }
}

function renderThemes() {
  const container = document.getElementById('theme-selector');
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
  document.getElementById('theme-title').innerText = `Tema ${prompt.themeNumber}: ${prompt.title}`;
  document.getElementById('theme-texts').innerHTML = prompt.motivationalTexts.replace(/\n/g, '<br>');

  const submitBtn = document.getElementById('btn-submit-essay');
  if (prompt.isSubmitted) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Redação Já Enviada';
    submitBtn.style.background = 'var(--text-muted)';
  } else {
    submitBtn.disabled = false;
    submitBtn.innerText = '🚀 Enviar para Correção com IA';
    submitBtn.style.background = 'var(--primary)';
  }
};

// Web Speech API: Reconhecimento de Voz nativo
function setupSpeechRecognition() {
  const btnMic = document.getElementById('btn-mic');
  const textarea = document.getElementById('essay-text');

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
  textarea.addEventListener('input', () => {
    countSpan.innerText = `${textarea.value.length} caracteres (mínimo de 200)`;
  });

  document.getElementById('btn-submit-essay').addEventListener('click', submitEssay);
}

async function submitEssay() {
  const content = document.getElementById('essay-text').value;
  if (!selectedPromptId) {
    alert('Selecione um tema primeiro.');
    return;
  }
  if (content.trim().length < 200) {
    alert('A sua redação precisa ter no mínimo 200 caracteres para ser avaliada.');
    return;
  }

  const btn = document.getElementById('btn-submit-essay');
  btn.disabled = true;
  btn.innerText = '⏳ A IA do PAES UEMA está corrigindo sua redação...';

  try {
    const res = await window.api.post('/essays/submit', {
      promptId: selectedPromptId,
      content,
    });

    displayResult(res);
    checkEssayStatus();
  } catch (error) {
    alert(error.message || 'Erro ao enviar redação.');
    btn.disabled = false;
    btn.innerText = '🚀 Enviar para Correção com IA';
  }
}

function displayResult(res) {
  const card = document.getElementById('result-card');
  card.style.display = 'block';
  document.getElementById('res-total').innerText = `${Number(res.totalScore).toFixed(2)} / 10.0`;

  document.getElementById('criteria-grid').innerHTML = `
    <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
      <strong>Tema e Tipologia:</strong><br>${Number(res.criteria.themeGenre).toFixed(2)} / 2.50
    </div>
    <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
      <strong>Coerência e Argumentação:</strong><br>${Number(res.criteria.coherence).toFixed(2)} / 2.50
    </div>
    <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
      <strong>Coesão Textual:</strong><br>${Number(res.criteria.cohesion).toFixed(2)} / 2.50
    </div>
    <div style="background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
      <strong>Norma Padrão:</strong><br>${Number(res.criteria.grammarNorm).toFixed(2)} / 2.50
    </div>
  `;

  document.getElementById('res-feedback').innerText = res.feedback?.pedagogical_feedback || 'Redação corrigida com sucesso.';
  card.scrollIntoView({ behavior: 'smooth' });
}
