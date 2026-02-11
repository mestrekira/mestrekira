import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
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
  return 'index.html'; // fallback seguro
}

document.addEventListener('DOMContentLoaded', () => {
  const token = getTokenFromUrl();

  const hintEl = document.getElementById('hint');
  const passEl = document.getElementById('newPassword');
  const confirmEl = document.getElementById('confirmPassword');
  const btn = document.getElementById('resetBtn');

  if (!btn) return;

  if (!token) {
    setStatus('Token ausente. Use o link enviado ao seu e-mail.');
    if (hintEl) hintEl.textContent = 'Token ausente. Volte e solicite um novo link.';
    disable(btn, true);
    return;
  }

  btn.addEventListener('click', async () => {
    const newPassword = passEl?.value || '';
    const confirm = confirmEl?.value || '';

    setStatus('');

    if (!newPassword || newPassword.length < 8) {
      setStatus('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirm) {
      setStatus('As senhas não coincidem.');
      return;
    }

    disable(btn, true);
    setStatus('Salvando nova senha...');

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus(data?.message || data?.error || 'Não foi possível redefinir a senha.');
        disable(btn, false);
        return;
      }

      setStatus('Senha redefinida com sucesso! Você já pode fazer login.');

      if (passEl) passEl.value = '';
      if (confirmEl) confirmEl.value = '';

      const target = getRedirectTarget();
      setTimeout(() => window.location.replace(target), 1200);
    } catch {
      setStatus('Erro ao redefinir senha. Tente novamente.');
      disable(btn, false);
    }
  });
});
