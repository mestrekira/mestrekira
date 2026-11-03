// entrar-sala.js (final / prático)
// - NÃO faz login/cadastro aqui (apenas entra na sala)
// - exige sessão válida de aluno via auth.js
// - usa authFetch + readErrorMessage do auth.js
// - compat: envia studentId (se backend ainda exigir)

import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

import {
  requireStudentSession,
  authFetch,
  readErrorMessage,
  getStudentIdCompat,
} from './auth.js';

// -------------------- UI --------------------
const status = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');
const codeEl = document.getElementById('code');

function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 4200 : type === 'warn' ? 3200 : 2400),
    });
  } catch {
    if (type === 'error') alert(`${title}\n\n${message}`);
  }
}

function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function setBusy(busy) {
  const b = !!busy;
  if (enterBtn) enterBtn.disabled = b;
  if (codeEl) codeEl.disabled = b;
  if (enterBtn) enterBtn.style.opacity = b ? '0.7' : '1';
}

// -------------------- Guard --------------------
// garante sessão + studentId (retorna id, mas aqui usamos compat também)
requireStudentSession({ redirectTo: 'login-aluno.html' });

// -------------------- Action --------------------
async function entrarSala() {
  const code = (codeEl?.value || '').trim().toUpperCase();

  if (!code) {
    setStatus('Informe o código da sala.');
    notify('warn', 'Código obrigatório', 'Digite o código da sala para entrar.');
    return;
  }

  setBusy(true);
  setStatus('Entrando na sala...');

  try {
    const studentId = getStudentIdCompat(); // compat (auth.js garante existir)
    const res = await authFetch(
      `${API_URL}/enrollments/join`,
      {
        method: 'POST',
        body: JSON.stringify({ code, studentId }),
      },
      { redirectTo: 'login-aluno.html' },
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    const data = await res.json().catch(() => null);
    const roomId = data?.roomId || data?.id || data?.room?.id;

    if (!roomId) {
      throw new Error('Resposta inválida do servidor (roomId ausente).');
    }

    notify('success', 'Tudo certo', 'Você entrou na sala!');
    window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(
      String(roomId),
    )}`;
  } catch (e) {
    const msg = String(e?.message || 'Erro ao entrar na sala.');
    // AUTH_401/403 já redireciona dentro do authFetch
    if (!msg.startsWith('AUTH_')) {
      setStatus('Erro ao entrar na sala. Verifique o código.');
      notify('error', 'Não foi possível entrar', msg);
      setBusy(false);
    }
  }
}

// Eventos
if (enterBtn) enterBtn.addEventListener('click', entrarSala);
if (codeEl) {
  codeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarSala();
  });
}
