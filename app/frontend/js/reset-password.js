// reset-password.js
// Página que define a nova senha (via token no link)
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration:
      duration ??
      (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('token') || '').trim();
}

function getRoleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const role = (params.get('role') || '').trim().toLowerCase();
  return role === 'professor' || role === 'student' ? role : '';
}

function getRedirectTarget() {
  const role = getRoleFromUrl();
  if (role === 'professor') return 'login-professor.html';
  if (role === 'student') return 'login-aluno.html';
  return 'index.html'; // fallback
}

document.addEventListener('DOMContentLoaded', () => {
  const token = getTokenFromUrl();

  const passEl = document.getElementById('newPassword');
  const confirmEl = document.getElementById('confirmPassword');
  const btn = document.getElementById('resetBtn');

  if (!btn) return;

  if (!token) {
    disable(btn, true);
    notify(
      'error',
      'Link inválido',
      'Token ausente. Use o link enviado ao seu e-mail e solicite um novo se necessário.',
      5200,
    );
    return;
  }

  btn.addEventListener('click', async () => {
    const newPassword = passEl?.value || '';
    const confirm = confirmEl?.value || '';

    if (!newPassword || newPassword.length < 8) {
      notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirm) {
      notify('warn', 'Senhas diferentes', 'As senhas não coincidem.');
      return;
    }

    disable(btn, true);
    notify('info', 'Salvando...', 'Aplicando sua nova senha...', 1800);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        notify(
          'error',
          'Não foi possível redefinir',
          data?.message || data?.error || 'Tente novamente.',
        );
        disable(btn, false);
        return;
      }

      notify('success', 'Pronto!', 'Senha redefinida com sucesso. Faça login.', 2200);

      if (passEl) passEl.value = '';
      if (confirmEl) confirmEl.value = '';

      const target = getRedirectTarget();
      setTimeout(() => window.location.replace(target), 1200);
    } catch {
      notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
      disable(btn, false);
    }
  });
});
