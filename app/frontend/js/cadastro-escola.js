// cadastro-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const $ = (id) => document.getElementById(id);

const nameEl = $('name');
const emailEl = $('email');
const passEl = $('password');
const btn = $('registerBtn');
const statusEl = $('status');

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(value) {
  if (btn) btn.disabled = !!value;
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function cadastrar() {
  const name = String(nameEl?.value || '').trim();
  const email = String(emailEl?.value || '').trim().toLowerCase();
  const password = String(passEl?.value || '');

  setStatus('');

  if (!name || !email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha nome, e-mail e senha.');
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

  disable(true);
  notify('info', 'Cadastrando...', 'Criando a conta da escola...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/register-school`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data) {
      notify('error', 'Erro', data?.message || data?.error || 'Não foi possível criar o cadastro.');
      setStatus(data?.message || data?.error || 'Erro no cadastro.');
      return;
    }

    // compat: alguns retornos podem vir sem ok, então tratamos pelos campos
    if (data?.ok === false) {
      notify('error', 'Erro no cadastro', data?.message || data?.error || 'Falha no cadastro.');
      setStatus(data?.message || data?.error || 'Falha no cadastro.');
      return;
    }

    notify(
      'success',
      'Cadastro criado',
      data?.message || 'Cadastro criado. Confirme seu e-mail para acessar.',
      3200,
    );

    setStatus('Cadastro criado. Agora confirme o e-mail e faça login.');

    // pré-preenche e-mail e redireciona pro login
    setTimeout(() => {
      window.location.href = `login-escola.html?email=${encodeURIComponent(email)}`;
    }, 600);
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  btn?.addEventListener('click', cadastrar);

  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cadastrar();
  });
});
