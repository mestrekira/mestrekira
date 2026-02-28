// login-professor.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',

  // legados (se existirem)
  professorName: 'professorName',
  professorEmail: 'professorEmail',
};

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = String(msg || '');
}

function normRole(role) {
  return String(role || '').trim().toUpperCase(); // PROFESSOR | STUDENT | SCHOOL
}

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);

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
  const el = document.getElementById('emailLogin');
  return (el?.value || '').trim().toLowerCase();
}

function redirectAfterLogin(userObj) {
  if (userObj?.mustChangePassword) {
    window.location.replace('trocar-senha.html');
  } else {
    window.location.replace('professor-salas.html');
  }
}

/**
 * ✅ Perfil seguro do token (evita /users/:id)
 * GET /users/me  (JwtAuthGuard)
 */
async function fetchMe(token) {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${String(token)}` },
  });

  const data = await readJsonSafe(res);

  if (!res.ok || !data) {
    const msg = data?.message || data?.error || 'Não foi possível carregar seu perfil.';
    // se deu 401/403, limpa sessão pra não ficar loopando
    if (res.status === 401 || res.status === 403) {
      clearAuthStorage();
    }
    throw new Error(msg);
  }

  return data;
}

/**
 * LOGIN (professor individual OU professor via escola)
 * POST /auth/login
 */
async function fazerLogin() {
  const email = getLoginEmail();
  const passEl = document.getElementById('passwordLogin');
  const password = passEl?.value || '';

  const loginBtn = document.getElementById('loginBtn');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  show(resendVerifyBtn, false);
  setStatus('');

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
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await readJsonSafe(res);

    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor. Tente novamente.');
      return;
    }

    // Falha de login
    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Usuário ou senha inválidos.';

      // caso especial: e-mail não verificado
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

    // ✅ professor individual e professor cadastrado pela escola continuam role=PROFESSOR
    if (role !== 'PROFESSOR' && role !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      setStatus('Acesso negado.');
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      clearAuthStorage();
      notify('error', 'Erro', 'Login ok, mas o servidor não retornou o ID do professor.');
      setStatus('Erro: servidor não retornou o ID.');
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem(LS.studentId);

    // grava auth (mínimo)
    localStorage.setItem(LS.token, String(data.token));
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.professorId, String(userId));

    // ✅ busca perfil completo via /users/me (mustChangePassword, etc.)
    let me = null;
    try {
      me = await fetchMe(data.token);
    } catch (e) {
      notify(
        'warn',
        'Login realizado',
        'Entrou, mas não foi possível carregar seu perfil completo. Se algo estiver estranho, recarregue a página.',
        2600,
      );
      // fallback: usa o user do login
      redirectAfterLogin(data.user);
      return;
    }

    const meRole = normRole(me?.role);
    if (meRole && meRole !== 'PROFESSOR' && meRole !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      setStatus('Acesso negado.');
      return;
    }

    // atualiza user no storage com dados completos
    const mergedUser = { ...(data.user || {}), ...(me || {}) };
    localStorage.setItem(LS.user, JSON.stringify(mergedUser));

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

/**
 * REENVIAR VERIFICAÇÃO
 * POST /auth/request-verify
 */
async function reenviarVerificacao() {
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
  const email = getLoginEmail();

  if (!email) {
    notify('warn', 'Digite seu e-mail', 'Informe seu e-mail de login para reenviar o link.');
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

/**
 * CADASTRO PROFESSOR INDIVIDUAL (compat)
 * POST /users/professor
 * (recomendado no futuro: /auth/register-professor)
 */
async function cadastrarProfessor() {
  const nameEl = document.getElementById('nameRegister');
  const emailEl = document.getElementById('emailRegister');
  const passEl = document.getElementById('passwordRegister');
  const registerBtn = document.getElementById('registerBtn');

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
    const res = await fetch(`${API_URL}/users/professor`, {
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
      'Cadastro criado',
      data?.message || 'Cadastro criado. Confirme seu e-mail para acessar.',
      3000,
    );

    setStatus('Cadastro criado. Agora confirme o e-mail e faça login.');

    // opcional: já preenche o login
    const emailLogin = document.getElementById('emailLogin');
    if (emailLogin) emailLogin.value = email;
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(registerBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const passLogin = document.getElementById('passwordLogin');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  const registerBtn = document.getElementById('registerBtn');
  const passRegister = document.getElementById('passwordRegister');

  if (justLoggedOutGuard()) return;

  // Auto redirect se já logado como professor
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (token && (role === 'PROFESSOR' || role === 'TEACHER')) {
    // se não tiver mustChangePassword no storage, ainda pode ser verdadeiro no backend
    // então tentamos /users/me (silencioso) pra confirmar e decidir rota
    (async () => {
      try {
        const me = await fetchMe(token);
        const merged = { ...(user || {}), ...(me || {}) };
        localStorage.setItem(LS.user, JSON.stringify(merged));
        redirectAfterLogin(merged);
      } catch {
        // fallback
        redirectAfterLogin(user);
      }
    })();
    return;
  }

  // login
  if (loginBtn) loginBtn.addEventListener('click', fazerLogin);
  if (passLogin) {
    passLogin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }

  // resend verify
  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
    show(resendVerifyBtn, false);
  }

  // register
  if (registerBtn) registerBtn.addEventListener('click', cadastrarProfessor);
  if (passRegister) {
    passRegister.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cadastrarProfessor();
    });
  }
});
