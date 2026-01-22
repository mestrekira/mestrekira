import { API_URL } from './config.js';

const status = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');
const codeEl = document.getElementById('code');

const studentId = localStorage.getItem('studentId');

// ✅ precisa estar logado como aluno
if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente (login necessário)');
}

function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function setBusy(busy) {
  if (enterBtn) enterBtn.disabled = !!busy;
  if (codeEl) codeEl.disabled = !!busy;
}

async function entrar() {
  const code = (codeEl?.value || '').trim().toUpperCase();

  if (!code) {
    setStatus('Informe o código da sala.');
    return;
  }

  setStatus('Entrando na sala...');
  setBusy(true);

  try {
    const response = await fetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) throw new Error();

    if (!data?.roomId) {
      setStatus('Resposta inválida do servidor.');
      setBusy(false);
      return;
    }

    window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(data.roomId)}`;
  } catch {
    setStatus('Erro ao entrar na sala. Verifique o código.');
    setBusy(false);
  }
}

if (enterBtn) enterBtn.addEventListener('click', entrar);

// Enter no input
if (codeEl) {
  codeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrar();
  });
}
