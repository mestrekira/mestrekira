import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function getEmail() {
  const el = document.getElementById('email');
  return (el?.value || '').trim().toLowerCase();
}

function getRoleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const role = (params.get('role') || '').trim().toLowerCase();
  return role === 'professor' || role === 'student' ? role : undefined;
}

async function enviarLink() {
  const btn = document.getElementById('sendBtn');
  const email = getEmail();
  const role = getRoleFromUrl();

  setStatus('');

  if (!email) {
    setStatus('Digite seu e-mail.');
    return;
  }

  disable(btn, true);
  setStatus('Enviando...');

  try {
    const res = await fetch(`${API_URL}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setStatus(data?.message || data?.error || 'Não foi possível enviar o link agora.');
      return;
    }

    setStatus('Se o e-mail existir, enviamos um link. Verifique a caixa de entrada e o Spam.');
  } catch {
    setStatus('Erro ao enviar o link. Tente novamente.');
  } finally {
    disable(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('sendBtn');
  const email = document.getElementById('email');

  if (btn) btn.addEventListener('click', enviarLink);

  if (email) {
    email.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enviarLink();
    });
  }
});
