import { api } from './api.js';

let promptsData = [];
let selectedPromptId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkEssayStatus();
  setupSpeechRecognition();
  setupCounter();
});

async function checkEssayStatus() {
  try {
    const res = await api.get('/essays/cycle-status');
    if (!res) return;

    if (!res.unlocked) {
      document.getElementById('locked-view').style.display = 'block';
      document.getElementById('lock-message').innerText = res.message;
      document.getElementById('unlocked-view').style.display = 'none';
      return;
    }

    document.getElementById('locked-view').style.display = 'none';
    document.getElementById('unlocked-view').style.display = 'block';

    promptsData = res.prompts;
    renderThemes();
  } catch (error) {
    alert(error.message || 'Erro ao carregar módulo de redação.');
  }
}

function renderThemes() {
  const container = document.getElementById('theme-selector');
  container.innerHTML = promptsData.map((p) => `
    <button class="btn ${p.id === selectedPromptId ? '' : 'btn-secondary'}" 
            onclick="selectTheme('${p.id}')">
      Tema ${p.themeNumber}: ${p.isSubmitted ? `(Nota: ${p.score})` : 'Disponível'}
    </button>
  `).join('');

  if (promptsData.length > 0 && !selectedPromptId) {
    selectTheme(promptsData[0].id);
  }
}

window.selectTheme = (promptId) => {
  selectedPromptId = promptId;
  const prompt = promptsData.find(p => p.id === promptId);
  if (!prompt) return;

  renderThemes();
  document.getElementById('theme-title').innerText = `Tema ${prompt.themeNumber}: ${prompt.title}`;
  document.getElementById('theme-texts').innerHTML = prompt.motivationalTexts.replace(/\n/g, '<br>');

  const submitBtn = document.getElementById('btn-submit-essay');
  if (prompt.isSubmitted) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Redação Já Enviada';
  } else {
    submitBtn.disabled = false;
    submitBtn.innerText = '🚀 Enviar para Correção por IA';
  }
};

// Integração com a Web Speech API (Microfone)
function setupSpeechRecognition() {
  const btnMic = document.getElementById('btn-mic');
  const textarea = document.getElementById('essay-text');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    btnMic.style.display = 'none'; // Navegador sem suporte
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
    alert('Selecione um tema.');
    return;
  }
  if (content.trim().length < 200) {
    alert('A redação deve ter no mínimo 200 caracteres.');
    return;
  }

  const btn = document.getElementById('btn-submit-essay');
  btn.disabled = true;
  btn.innerText = '⏳ A IA do PAES UEMA está corrigindo sua redação...';

  try {
    const res = await api.post('/essays/submit', {
      promptId: selectedPromptId,
      content,
    });

    displayResult(res);
    checkEssayStatus();
  } catch (error) {
    alert(error.message || 'Erro ao enviar redação.');
    btn.disabled = false;
    btn.innerText = '🚀 Enviar para Correção por IA';
  }
}

function displayResult(res) {
  const card = document.getElementById('result-card');
  card.style.display = 'block';
  document.getElementById('res-total').innerText = `${res.totalScore.toFixed(2)} / 10.0`;

  document.getElementById('criteria-grid').innerHTML = `
    <div style="background: #f8fafc; padding: 0.75rem; border-radius: 6px;">
      <strong>Tema e Tipologia:</strong><br>${res.criteria.themeGenre} / 2.50
    </div>
    <div style="background: #f8fafc; padding: 0.75rem; border-radius: 6px;">
      <strong>Coerência e Argumentação:</strong><br>${res.criteria.coherence} / 2.50
    </div>
    <div style="background: #f8fafc; padding: 0.75rem; border-radius: 6px;">
      <strong>Coesão Textual:</strong><br>${res.criteria.cohesion} / 2.50
    </div>
    <div style="background: #f8fafc; padding: 0.75rem; border-radius: 6px;">
      <strong>Norma Padrão:</strong><br>${res.criteria.grammarNorm} / 2.50
    </div>
  `;

  document.getElementById('res-feedback').innerText = res.feedback.pedagogical_feedback;
  card.scrollIntoView({ behavior: 'smooth' });
}
