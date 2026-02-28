// cadastro-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const $ = (id) => document.getElementById(id);

const nameEl = $('name');
const emailEl = $('email');
const passEl = $('password');

const btnRegister = $('btnRegister');
const statusEl = $('status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(btn, v) {
  if (btn) btn.disabled = !!v;
}

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

async function cadastrarEscola() {
  const name = String(nameEl?.value || '').trim();
  const email = normEmail(emailEl?.value);
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

  disable(btnRegister, true);
  notify('info', 'Cadastrando...', 'Criando a conta da escola...', 1800);

  try {
    // ✅ usa /users/school (compatível com seu UsersController atual)
    const res = await fetch(`${API_URL}/users/school`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data) {
      notify('error', 'Erro', 'Resposta inválida do servidor.');
      return;
    }

    if (!data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível criar o cadastro.';
      notify('error', 'Erro no cadastro', msg);
      setStatus(msg);
      return;
    }

    notify(
      'success',
      'Cadastro criado',
      data?.message || 'Cadastro criado. Confirme seu e-mail para acessar.',
      3200,
    );

    setStatus('Cadastro criado. Agora confirme o e-mail e faça login como escola.');
    // preenche e-mail no login (se quiser)
    sessionStorage.setItem('mk_school_prefill_email', email);

    // manda para login
    window.location.href = 'login-escola.html';
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(btnRegister, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  btnRegister?.addEventListener('click', cadastrarEscola);
  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cadastrarEscola();
  });
});
