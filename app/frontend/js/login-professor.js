import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',
  schoolId: 'schoolId',

  // legados
  professorName: 'professorName',
  professorEmail: 'professorEmail',
};

const $ = (id) => document.getElementById(id);

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = String(msg || '');
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
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

  localStorage.removeItem(LS.professorName);
  localStorage.removeItem(LS.professorEmail);
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

function getLoginEmail() {
  return String($('emailLogin')?.value || '').trim().toLowerCase();
}

function redirectAfterLogin(userObj) {
  if (userObj?.mustChangePassword) {
    window.location.replace('trocar-senha.html');
  } else {
    window.location.replace('professor-salas.html');
  }
}

async function fetchMe(token) {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sanitizeToken(token)}`,
    },
  });

  const data = await readJsonSafe(res);

  if (!res.ok || !data) {
    const msg =
      data?.message || data?.error || 'Não foi possível carregar seu perfil.';
    if (res.status === 401 || res.status === 403) {
      clearAuthStorage();
    }
    throw new Error(String(msg));
  }

  return data;
}

async function debugToken(token) {
  try {
    const res = await fetch(`${API_URL}/auth/debug-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sanitizeToken(token) }),
    });

    return await readJsonSafe(res);
  } catch {
    return null;
  }
}

async function alreadyLoggedInGuard() {
  const token = sanitizeToken(localStorage.getItem(LS.token));
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || (role !== 'PROFESSOR' && role !== 'TEACHER')) {
    return false;
  }

  try {
    const me = await fetchMe(token);
    const meRole = normRole(me?.role || user?.role);

    if (meRole !== 'PROFESSOR' && meRole !== 'TEACHER') {
      clearAuthStorage();
      return false;
    }

    const merged = { ...(user || {}), ...(me || {}) };
    localStorage.setItem(LS.user, JSON.stringify(merged));

    if (!localStorage.getItem(LS.professorId) && merged?.id) {
      localStorage.setItem(LS.professorId, String(merged.id));
    }

    localStorage.setItem(LS.token, sanitizeToken(token));
    redirectAfterLogin(merged);
    return true;
  } catch {
    clearAuthStorage();
    return false;
  }
}

async function fazerLogin() {
  const email = getLoginEmail();
  const passEl = $('passwordLogin');
  const password = String(passEl?.value || '');

  const loginBtn = $('loginBtn');
  const resendVerifyBtn = $('resendVerifyBtn');

  show(resendVerifyBtn, false);
  setStatus('');

  if (!email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha e-mail e senha.');
    setStatus('Preencha e-mail e senha.');
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
      setStatus('Resposta inválida do servidor.');
      return;
    }

    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Usuário ou senha inválidos.';

      if (data?.emailVerified === false) {
        show(resendVerifyBtn, true);
        notify(
          'warn',
          'E-mail não confirmado',
          'Confirme seu e-mail para acessar. Se precisar, clique em “Reenviar link de verificação”.',
        );
        setStatus('E-mail não confirmado. Reenvie o link se necessário.');
      } else {
        notify('error', 'Não foi possível entrar', msg);
        setStatus(msg);
      }
      return;
    }

    const role = normRole(data?.user?.role);
    if (role !== 'PROFESSOR' && role !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      setStatus('Acesso negado.');
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
      setStatus('Erro: servidor não retornou credenciais válidas.');
      return;
    }

    localStorage.removeItem(LS.studentId);
    localStorage.removeItem(LS.schoolId);

    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.professorId, userId);

    const tokenCheck = await debugToken(token);
    if (!tokenCheck?.ok) {
      clearAuthStorage();
      notify(
        'error',
        'Token inválido',
        tokenCheck?.error || 'O token retornado pelo login não pôde ser validado.',
      );
      setStatus(
        `Falha ao validar token do login: ${String(
          tokenCheck?.error || 'Token inválido.',
        )}`,
      );
      return;
    }

    const decodedRole = normRole(tokenCheck?.decoded?.role);
    const decodedSub = String(tokenCheck?.decoded?.sub || '').trim();

    if (
      (decodedRole !== 'PROFESSOR' && decodedRole !== 'TEACHER') ||
      !decodedSub
    ) {
      clearAuthStorage();
      notify(
        'error',
        'Sessão inválida',
        'O token retornado não corresponde a uma conta de professor.',
      );
      setStatus('O token retornado não corresponde a uma conta de professor.');
      return;
    }

    let me = null;
    try {
      me = await fetchMe(token);
    } catch (e) {
      clearAuthStorage();
      notify(
        'error',
        'Login incompleto',
        'O token foi emitido, mas o perfil protegido não pôde ser carregado.',
      );
      setStatus(String(e?.message || 'Não foi possível carregar /users/me.'));
      return;
    }

    const meRole = normRole(me?.role);
    if (meRole && meRole !== 'PROFESSOR' && meRole !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      setStatus('Acesso negado.');
      return;
    }

    const mergedUser = { ...(data.user || {}), ...(me || {}) };
    localStorage.setItem(LS.user, JSON.stringify(mergedUser));
    localStorage.setItem(LS.professorId, String(mergedUser.id || userId));

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    setStatus('');

    redirectAfterLogin(mergedUser);
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(loginBtn, false);
  }
}

async function reenviarVerificacao() {
  const resendVerifyBtn = $('resendVerifyBtn');
  const email = getLoginEmail();

  if (!email) {
    notify(
      'warn',
      'Digite seu e-mail',
      'Informe seu e-mail de login para reenviar o link.',
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

async function cadastrarProfessor() {
  const nameEl = $('nameRegister');
  const emailEl = $('emailRegister');
  const passEl = $('passwordRegister');
  const registerBtn = $('registerBtn');

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

  disable(registerBtn, true);
  notify('info', 'Cadastrando...', 'Criando sua conta...', 1800);

  try {
    let res = await fetch(`${API_URL}/auth/register-professor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    let data = await readJsonSafe(res);

    if (res.status === 404) {
      res = await fetch(`${API_URL}/users/professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      data = await readJsonSafe(res);
    }

    if (!res.ok || !data?.ok) {
      const msg =
        data?.message || data?.error || 'Não foi possível criar o cadastro.';
      notify('error', 'Erro no cadastro', msg);
      setStatus(msg);
      return;
    }

    notify(
      'success',
      'Cadastro criado',
      data?.message || 'Cadastro criado. Confirme seu e-mail para acessar.',
      3000,
    );

    setStatus('Cadastro criado. Agora confirme o e-mail e faça login.');

    const emailLogin = $('emailLogin');
    if (emailLogin) emailLogin.value = email;
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(registerBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginBtn = $('loginBtn');
  const passLogin = $('passwordLogin');
  const resendVerifyBtn = $('resendVerifyBtn');

  const registerBtn = $('registerBtn');
  const passRegister = $('passwordRegister');

  if (justLoggedOutGuard()) return;
  if (await alreadyLoggedInGuard()) return;

  if (loginBtn) loginBtn.addEventListener('click', fazerLogin);

  if (passLogin) {
    passLogin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
    show(resendVerifyBtn, false);
  }

  if (registerBtn) registerBtn.addEventListener('click', cadastrarProfessor);

  if (passRegister) {
    passRegister.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cadastrarProfessor();
    });
  }
});
