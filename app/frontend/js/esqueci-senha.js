// esqueci-senha.js  (ou recuperar-senha.js / request-password-reset.js)
// Página que envia o link de redefinição
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

  if (!email) {
    notify('warn', 'Digite seu e-mail', 'Informe o e-mail para receber o link.');
    return;
  }

  disable(btn, true);
  notify('info', 'Enviando...', 'Gerando seu link de redefinição...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      notify(
        'error',
        'Não foi possível enviar',
        data?.message || data?.error || 'Tente novamente em instantes.',
      );
      return;
    }

    // ✅ mensagem segura (não revela se existe)
    notify(
      'success',
      'Se o e-mail existir…',
      'Enviamos um link. Verifique a caixa de entrada e o Spam.',
      4200,
    );
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
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
