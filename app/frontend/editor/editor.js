const editor = document.getElementById('editor');
const wordCount = document.getElementById('wordCount');

const API_URL = 'http://localhost:3000';

// IDs simulados (depois virão do login)
const roomId = 'ID_DA_SALA';
const studentId = 'ID_DO_ESTUDANTE';

let currentEssayId = null;

// 🔒 BLOQUEAR COLAR TEXTO
editor.addEventListener('paste', e => e.preventDefault());
editor.addEventListener('contextmenu', e => e.preventDefault());

editor.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'v') {
    e.preventDefault();
  }
});

// 🔢 CONTADOR DE PALAVRAS
editor.addEventListener('input', () => {
  const text = editor.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = `${words} palavras`;
});

// 💾 SALVAR RASCUNHO
async function saveDraft() {
  const text = editor.value;

  if (!text.trim()) {
    alert('O texto está vazio.');
    return;
  }

  const response = await fetch(`${API_URL}/essays/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      studentId,
      text,
    }),
  });

  const data = await response.json();
  currentEssayId = data.id;

  alert('Rascunho salvo!');
}

// 📤 ENVIAR REDAÇÃO
async function submitEssay() {
  if (!currentEssayId) {
    alert('Salve o rascunho antes de enviar.');
    return;
  }

  await fetch(`${API_URL}/essays/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      essayId: currentEssayId,
    }),
  });

  alert('Redação enviada com sucesso!');
}
