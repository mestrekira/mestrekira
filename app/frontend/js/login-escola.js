// login-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const $ = (id) => document.getElementById(id);

const emailEl = $('email');
const passEl = $('password');
const btn = $('btnLogin');
const statusEl = $('status');
const resendVerifyBtn = $('resendVerifyBtn');

const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',
  studentId: 'studentId',
  professorId: 'professorId',
};

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(el, v) {
  if (el) el.disabled = !!v;
}

function show(el, v) {
  if (!el) return;
  el.style.display = v ? 'inline-block' : 'none';
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

function normRole(role) {
  return String(role || '').trim().toLowerCase();
}

function clearOtherRoles() {
  // evita conflito
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);
}

async function login() {
  const email = String(emailEl?.value || '').trim().toLowerCase();
  const password = String(passEl?.value || '');

  show(resendVerifyBtn, false);
  setStatus('');

  if (!email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha e-mail e senha.');
    setStatus('Preencha e-mail e senha.');
    return;
  }

  disable(btn, true);
  notify('info', 'Entrando...', 'Verificando seus dados...', 1800);
  setStatus('Entrando...');

  try {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonSafe(r);

    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor.');
      setStatus('Resposta inválida do servidor.');
      return;
    }

    if (!data?.ok || !data?.token || !data?.user) {
      const msg = data?.error || data?.message || 'Falha no login.';
      if (data?.emailVerified === false) {
        show(resendVerifyBtn, true);
        notify(
          'warn',
          'E-mail não confirmado',
          'Confirme seu e-mail para acessar. Se precisar, clique em “Reenviar link de verificação”.',
        );
        setStatus('E-mail não confirmado.');
      } else {
        notify('error', 'Não foi possível entrar', msg);
        setStatus(msg);
      }
      return;
    }

    const role = normRole(data?.user?.role);

    if (role !== 'school') {
      notify('error', 'Acesso negado', 'Este login é exclusivo para escolas.');
      setStatus('Este login é exclusivo para escola.');
      return;
    }

    clearOtherRoles();

    localStorage.setItem(LS.token, String(data.token));
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.schoolId, String(data.user.id)); // ✅ usado no index.js

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    setStatus('');

    window.location.href = 'painel-escola.html';
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro ao conectar.');
  } finally {
    disable(btn, false);
  }
}

async function reenviarVerificacao() {
  const email = String(emailEl?.value || '').trim().toLowerCase();

  if (!email) {
    notify('warn', 'Digite seu e-mail', 'Informe o e-mail para reenviar o link.');
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
      notify('error', 'Não foi possível reenviar', data?.message || data?.error || 'Tente novamente.');
      return;
    }

    notify('success', 'Link enviado', 'Verifique a caixa de entrada e o Spam.');
    show(resendVerifyBtn, false);
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // prefill do cadastro
  const prefill = sessionStorage.getItem('mk_school_prefill_email');
  if (prefill && emailEl) {
    emailEl.value = prefill;
    sessionStorage.removeItem('mk_school_prefill_email');
  }

  btn?.addEventListener('click', login);
  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  resendVerifyBtn?.addEventListener('click', reenviarVerificacao);
  show(resendVerifyBtn, false);

  // se já estiver logado como escola, manda pro painel
  const token = localStorage.getItem(LS.token);
  const user = (() => { try { return JSON.parse(localStorage.getItem(LS.user) || 'null'); } catch { return null; } })();
  if (token && normRole(user?.role) === 'school') {
    window.location.href = 'painel-escola.html';
  }
});
