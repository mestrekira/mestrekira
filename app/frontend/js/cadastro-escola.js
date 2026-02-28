// cadastro-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = String(msg || '');
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return (el?.value || '').trim();
}

async function cadastrarEscola() {
  const btn = document.getElementById('registerBtn');

  const name = getValue('name');
  const email = getValue('email').toLowerCase();
  const password = getValue('password');

  setStatus('');

  if (!name || !email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha nome da escola, e-mail e senha.');
    return;
  }

  if (!email.includes('@')) {
    notify('warn', 'E-mail inválido', 'Informe um e-mail válido.');
    return;
  }

  if (password.length < 8) {
    notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
    return;
  }

  disable(btn, true);
  notify('info', 'Cadastrando...', 'Criando a conta da escola...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/register-school`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível criar o cadastro.';
      notify('error', 'Erro no cadastro', msg);
      setStatus(msg);
      return;
    }

    notify(
      'success',
      'Conta criada',
      'Cadastro realizado! Agora confirme o e-mail para acessar.',
      3200,
    );

    setStatus('Cadastro criado. Verifique seu e-mail (Inbox e Spam) para confirmar.');

    // Opcional: após alguns segundos, volta para a home/login
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1800);
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('registerBtn');
  const pass = document.getElementById('password');

  if (btn) btn.addEventListener('click', cadastrarEscola);

  if (pass) {
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cadastrarEscola();
    });
  }
});
