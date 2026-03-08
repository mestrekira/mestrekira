import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',
  schoolId: 'schoolId',

  // legados
  studentName: 'studentName',
  studentEmail: 'studentEmail',
};

function $(id) {
  return document.getElementById(id);
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function getEmail() {
  return String($('email')?.value || '').trim().toLowerCase();
}

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration:
      duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function sanitizeToken(value) {
  let t = String(value || '').trim();

  if (/^Bearer\s+/i.test(t)) {
    t = t.replace(/^Bearer\s+/i, '').trim();
  }

  t = t.replace(/^['"]+|['"]+$/g, '').trim();

  return t;
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.schoolId);

  localStorage.removeItem(LS.studentName);
  localStorage.removeItem(LS.studentEmail);
}

function justLoggedOutGuard() {
  if (sessionStorage.getItem('mk_just_logged_out') === '1') {
    sessionStorage.removeItem('mk_just_logged_out');
    clearAuthStorage();
    return true;
  }
  return false;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMe(token) {
  const cleanToken = sanitizeToken(token);

  const res = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
    },
  });

  const data = await readJsonSafe(res);

  if (!res.ok || !data) {
    if (res.status === 401 || res.status === 403) {
      clearAuthStorage();
    }
    throw new Error(
      data?.message || data?.error || 'Não foi possível validar sua sessão.',
    );
  }

  return data;
}

async function fazerLogin() {
  const passEl = $('password');
  const loginBtn = $('loginBtn');
  const resendVerifyBtn = $('resendVerifyBtn');

  const email = getEmail();
  const password = String(passEl?.value || '');

  show(resendVerifyBtn, false);

  if (!email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha e-mail e senha.');
    return;
  }

  disable(loginBtn, true);
  notify('info', 'Entrando...', 'Verificando seus dados...', 1800);

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonSafe(res);

    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor. Tente novamente.');
      return;
    }

    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Usuário ou senha inválidos.';

      if (data?.emailVerified === false) {
        show(resendVerifyBtn, true);
        notify(
          'warn',
          'E-mail não confirmado',
          'Confirme seu e-mail para acessar. Se precisar, clique em “Reenviar verificação”.',
        );
      } else {
        notify('error', 'Não foi possível entrar', msg);
      }
      return;
    }

    const role = normRole(data.user.role);

    if (role !== 'STUDENT' && role !== 'ALUNO') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para estudantes.');
      return;
    }

    const userId = String(data?.user?.id || '').trim();
    const token = sanitizeToken(data?.token);

    if (!userId || !token) {
      clearAuthStorage();
      notify(
        'error',
        'Erro',
        'Login ok, mas o servidor não retornou ID/token válidos.',
      );
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem(LS.professorId);
    localStorage.removeItem(LS.schoolId);

    // grava auth limpo
    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.studentId, userId);

    // valida sessão protegida antes de redirecionar
    try {
      const me = await fetchMe(token);
      const meRole = normRole(me?.role || data?.user?.role);

      if (meRole !== 'STUDENT' && meRole !== 'ALUNO') {
        clearAuthStorage();
        notify(
          'error',
          'Acesso negado',
          'Este acesso é apenas para estudantes.',
        );
        return;
      }

      const merged = { ...(data.user || {}), ...(me || {}) };
      localStorage.setItem(LS.user, JSON.stringify(merged));
      localStorage.setItem(LS.studentId, String(merged.id || userId));
    } catch (e) {
      clearAuthStorage();
      notify(
        'error',
        'Login incompleto',
        String(e?.message || 'Não foi possível validar a sessão do aluno.'),
      );
      return;
    }

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    window.location.replace('painel-aluno.html');
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
  } finally {
    disable(loginBtn, false);
  }
}

async function reenviarVerificacao() {
  const resendVerifyBtn = $('resendVerifyBtn');
  const email = getEmail();

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

    notify('success', 'Link enviado', 'Verifique a caixa de entrada e o Spam.');
    show(resendVerifyBtn, false);
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const btn = $('loginBtn');
  const pass = $('password');
  const resendVerifyBtn = $('resendVerifyBtn');

  if (justLoggedOutGuard()) return;

  const token = sanitizeToken(localStorage.getItem(LS.token));
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (token) {
    localStorage.setItem(LS.token, token);
  }

  if (token && (role === 'STUDENT' || role === 'ALUNO')) {
    try {
      const me = await fetchMe(token);
      const meRole = normRole(me?.role || role);

      if (meRole === 'STUDENT' || meRole === 'ALUNO') {
        const merged = { ...(user || {}), ...(me || {}) };
        localStorage.setItem(LS.user, JSON.stringify(merged));
        localStorage.setItem(LS.studentId, String(merged.id || user?.id || ''));
        window.location.replace('painel-aluno.html');
        return;
      }

      clearAuthStorage();
    } catch {
      clearAuthStorage();
    }
  }

  if (btn) btn.addEventListener('click', fazerLogin);

  if (pass) {
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
    show(resendVerifyBtn, false);
  }
});
