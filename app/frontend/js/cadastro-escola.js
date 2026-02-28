// cadastro-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

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

function getValue(id) {
  const el = document.getElementById(id);
  return (el?.value || '').trim();
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function cadastrarEscola() {
  const registerBtn = document.getElementById('registerBtn');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  const name = getValue('name');
  const email = normalizeEmail(getValue('email'));
  const password = String(document.getElementById('password')?.value || '');

  show(resendVerifyBtn, false);
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

  disable(registerBtn, true);
  notify('info', 'Cadastrando...', 'Criando sua conta e enviando verificação...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/register-school`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data) {
      notify('error', 'Erro', 'Não foi possível concluir o cadastro agora.');
      return;
    }

    if (!data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível cadastrar.';
      notify('error', 'Cadastro não concluído', msg);
      setStatus(msg);
      return;
    }

    // Cadastro ok — por regra você exige verificação antes de login
    notify(
      'success',
      'Cadastro criado',
      'Enviamos um link de verificação para o e-mail informado. Verifique a caixa de entrada e o Spam.',
      3200,
    );

    // Mostra botão de reenviar (caso não chegue)
    show(resendVerifyBtn, true);

    // Sugestão: voltar para index após um tempo
    setTimeout(() => {
      window.location.replace('index.html');
    }, 1200);
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
  } finally {
    disable(registerBtn, false);
  }
}

async function reenviarVerificacao() {
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
  const email = normalizeEmail(getValue('email'));

  if (!email) {
    notify('warn', 'Digite seu e-mail', 'Informe seu e-mail para reenviar o link.');
    return;
  }

  disable(resendVerifyBtn, true);
  notify('info', 'Reenviando...', 'Enviando novo link de verificação...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/request-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data?.ok) {
      notify(
        'error',
        'Não foi possível reenviar',
        data?.message || data?.error || 'Tente novamente em instantes.',
      );
      return;
    }

    notify('success', 'Link enviado', 'Verifique a caixa de entrada e o Spam.', 2600);
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const registerBtn = document.getElementById('registerBtn');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
  const passwordEl = document.getElementById('password');

  if (registerBtn) registerBtn.addEventListener('click', cadastrarEscola);
  if (passwordEl) {
    passwordEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cadastrarEscola();
    });
  }

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
    show(resendVerifyBtn, false);
  }
});
