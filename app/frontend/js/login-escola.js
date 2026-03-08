import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',
  professorId: 'professorId',
  studentId: 'studentId',
};

const $ = (id) => document.getElementById(id);

const emailEl = $('email');
const passEl = $('password');
const btnLogin = $('btnLogin');
const statusEl = $('status');
const resendVerifyBtn = $('resendVerifyBtn');

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration:
      duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.schoolId);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function alreadyLoggedInGuard() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || role !== 'SCHOOL') return false;

  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearAuthStorage();
      return false;
    }

    const data = await readJsonSafe(res);
    const meRole = normRole(data?.role || data?.user?.role || user?.role);

    if (meRole !== 'SCHOOL') {
      clearAuthStorage();
      return false;
    }

    window.location.replace('painel-escola.html');
    return true;
  } catch {
    clearAuthStorage();
    return false;
  }
}

async function debugToken(token) {
  try {
    const res = await fetch(`${API_URL}/auth/debug-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    return await readJsonSafe(res);
  } catch {
    return null;
  }
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

  disable(btnLogin, true);
  notify('info', 'Entrando...', 'Verificando seus dados...', 1800);

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

    if (!r.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Falha no login.';
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
    if (role !== 'SCHOOL') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este login é exclusivo para escola.');
      setStatus('Este login é exclusivo para escola.');
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      clearAuthStorage();
      notify(
        'error',
        'Erro',
        'Login ok, mas o servidor não retornou o ID da escola.',
      );
      setStatus('Erro: servidor não retornou o ID.');
      return;
    }

    const token = String(data.token || '').trim();
    if (!token) {
      clearAuthStorage();
      notify('error', 'Erro', 'O servidor não retornou um token válido.');
      setStatus('Token ausente no retorno do login.');
      return;
    }

    localStorage.removeItem(LS.professorId);
    localStorage.removeItem(LS.studentId);

    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.schoolId, String(userId));

    const debug = await debugToken(token);

    if (!debug?.ok) {
      clearAuthStorage();
      notify(
        'error',
        'Token inválido',
        debug?.error || 'O token retornado pelo login não pôde ser validado.',
      );
      setStatus(
        `Falha ao validar token do login: ${String(debug?.error || 'Token inválido.')}`,
      );
      return;
    }

    const decodedRole = normRole(debug?.decoded?.role);
    const decodedSub = String(debug?.decoded?.sub || '').trim();

    if (decodedRole !== 'SCHOOL' || !decodedSub) {
      clearAuthStorage();
      notify(
        'error',
        'Sessão inválida',
        'O token retornado não corresponde a uma conta de escola.',
      );
      setStatus('O token retornado não corresponde a uma conta de escola.');
      return;
    }

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    window.location.replace('painel-escola.html');
  } catch {
    notify(
      'error',
      'Erro de conexão',
      'Não foi possível acessar o servidor agora.',
    );
    setStatus('Erro de conexão.');
  } finally {
    disable(btnLogin, false);
  }
}

async function reenviarVerificacao() {
  const email = String(emailEl?.value || '').trim().toLowerCase();
  if (!email) {
    notify(
      'warn',
      'Digite seu e-mail',
      'Informe seu e-mail para reenviar o link.',
    );
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

    notify('success', 'Link enviado', 'Verifique a caixa de entrada e o Spam.');
    show(resendVerifyBtn, false);
    setStatus('Link de verificação reenviado.');
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (await alreadyLoggedInGuard()) return;

  btnLogin?.addEventListener('click', login);

  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  resendVerifyBtn?.addEventListener('click', reenviarVerificacao);
  show(resendVerifyBtn, false);
});
