import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const form = document.getElementById('resetForm');
const passEl = document.getElementById('newPassword');
const confirmEl = document.getElementById('confirmPassword');
const btn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');

function disable(element, value) {
  if (element) element.disabled = !!value;
}

function setStatus(message = '') {
  if (statusEl) statusEl.textContent = message;
}

function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
    return;
  }

  if (type === 'error') {
    alert(`${title}\n\n${message}`);
  } else {
    console.log(`[${type}] ${title}: ${message}`);
  }
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('token') || '').trim();
}

function getRoleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const role = String(params.get('role') || '').trim().toLowerCase();

  if (role === 'professor' || role === 'student' || role === 'school') {
    return role;
  }

  return '';
}

function getRedirectTarget() {
  const role = getRoleFromUrl();

  if (role === 'professor') return 'login-professor.html';
  if (role === 'student') return 'login-aluno.html';
  if (role === 'school') return 'login-escola.html';

  return 'index.html';
}

function isStrongEnough(password) {
  return String(password || '').length >= 8;
}

async function redefinirSenha(event) {
  event?.preventDefault();

  const token = getTokenFromUrl();
  const newPassword = String(passEl?.value || '');
  const confirmPassword = String(confirmEl?.value || '');

  if (!token) {
    setStatus('Link inválido ou expirado.');
    notify(
      'error',
      'Link inválido',
      'Token ausente. Use o link enviado ao seu e-mail e solicite um novo se necessário.',
      5200,
    );
    disable(btn, true);
    return;
  }

  if (!isStrongEnough(newPassword)) {
    setStatus('A senha deve ter no mínimo 8 caracteres.');
    notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
    passEl?.focus();
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus('As senhas não coincidem.');
    notify('warn', 'Senhas diferentes', 'As senhas não coincidem.');
    confirmEl?.focus();
    return;
  }

  disable(btn, true);
  setStatus('Salvando nova senha...');
  notify('info', 'Salvando...', 'Aplicando sua nova senha...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      const message =
        data?.message ||
        data?.error ||
        'Tente novamente.';

      setStatus('Não foi possível redefinir a senha.');
      notify('error', 'Não foi possível redefinir', message);
      disable(btn, false);
      return;
    }

    setStatus('Senha redefinida com sucesso.');
    notify('success', 'Pronto!', 'Senha redefinida com sucesso. Faça login.', 2200);

    if (passEl) passEl.value = '';
    if (confirmEl) confirmEl.value = '';

    const target = getRedirectTarget();
    setTimeout(() => window.location.replace(target), 1200);
  } catch {
    setStatus('Erro de conexão com o servidor.');
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
    disable(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const token = getTokenFromUrl();

  if (!btn) return;

  if (!token) {
    disable(btn, true);
    setStatus('Abra esta página pelo link enviado ao seu e-mail.');
    if (hintEl) {
      hintEl.textContent =
        'Este link parece inválido ou incompleto. Solicite uma nova redefinição de senha.';
    }

    notify(
      'error',
      'Link inválido',
      'Token ausente. Use o link enviado ao seu e-mail e solicite um novo se necessário.',
      5200,
    );
    return;
  }

  form?.addEventListener('submit', redefinirSenha);

  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      redefinirSenha(e);
    }
  });

  confirmEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      redefinirSenha(e);
    }
  });
});
