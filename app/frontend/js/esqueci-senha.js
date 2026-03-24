import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const form = document.getElementById('recoverForm');
const emailInput = document.getElementById('email');
const sendBtn = document.getElementById('sendBtn');
const statusEl = document.getElementById('status');

function disable(btn, value) {
  if (!btn) return;
  btn.disabled = !!value;
}

function setStatus(message = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
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

function getEmail() {
  return String(emailInput?.value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRoleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const role = String(params.get('role') || '').trim().toLowerCase();

  if (role === 'professor' || role === 'student' || role === 'school') {
    return role;
  }

  return undefined;
}

async function enviarLink(event) {
  event?.preventDefault();

  const email = getEmail();
  const role = getRoleFromUrl();

  if (!email) {
    setStatus('Informe seu e-mail para continuar.');
    notify('warn', 'Digite seu e-mail', 'Informe o e-mail para receber o link.');
    emailInput?.focus();
    return;
  }

  if (!isValidEmail(email)) {
    setStatus('Digite um e-mail válido.');
    notify('warn', 'E-mail inválido', 'Digite um endereço de e-mail válido.');
    emailInput?.focus();
    return;
  }

  disable(sendBtn, true);
  setStatus('Enviando solicitação...');
  notify('info', 'Enviando...', 'Gerando seu link de redefinição...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      const message =
        data?.message ||
        data?.error ||
        'Tente novamente em instantes.';

      setStatus('Não foi possível concluir a solicitação.');
      notify('error', 'Não foi possível enviar', message);
      return;
    }

    setStatus('Se o e-mail existir, o link foi enviado.');
    notify(
      'success',
      'Se o e-mail existir…',
      'Enviamos um link. Verifique a caixa de entrada e também a pasta Spam.',
      4200,
    );

    form?.reset();
    emailInput?.focus();
  } catch {
    setStatus('Erro de conexão com o servidor.');
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
  } finally {
    disable(sendBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  form?.addEventListener('submit', enviarLink);

  emailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarLink(e);
    }
  });
});
