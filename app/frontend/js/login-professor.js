// login-professor.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',

  // legados (se existirem no seu projeto)
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

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function getEmail() {
  const emailEl = document.getElementById('email');
  return (emailEl?.value || '').trim().toLowerCase();
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

  // legados (se existirem)
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

/**
 * Busca o perfil pelo /users/:id para ler mustChangePassword e dados atualizados.
 */
async function fetchMe(userId, token) {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(String(userId))}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${String(token)}`,
    },
  });

  const data = await readJsonSafe(res);
  if (!res.ok || !data) {
    const msg = data?.message || data?.error || 'Não foi possível carregar seu perfil.';
    throw new Error(msg);
  }
  return data;
}

async function fazerLogin() {
  const passEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  const email = getEmail();
  const password = passEl?.value || '';

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
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await readJsonSafe(res);

    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor. Tente novamente.');
      return;
    }

    // Seu backend às vezes retorna { error } mesmo com 200
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

    // ✅ Aqui entra professor INDIVIDUAL e professor via ESCOLA (ambos são role=professor)
    if (role !== 'PROFESSOR' && role !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      clearAuthStorage();
      notify('error', 'Erro', 'Login ok, mas o servidor não retornou o ID do professor.');
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem(LS.studentId);

    // grava auth (rápido)
    localStorage.setItem(LS.token, String(data.token));
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.professorId, String(userId));

    // ✅ Agora confirma mustChangePassword no /users/:id
    let me = null;
    try {
      me = await fetchMe(userId, data.token);
    } catch (e) {
      // Se falhar, ainda deixa logado, mas avisa e segue para o painel
      notify(
        'warn',
        'Login realizado',
        'Entrou, mas não foi possível carregar seu perfil completo. Tente novamente se algo estiver estranho.',
        2600,
      );
      window.location.replace('professor-salas.html');
      return;
    }

    // Se por algum motivo o /users/:id vier com role diferente, bloqueia
    const meRole = normRole(me?.role);
    if (meRole && meRole !== 'PROFESSOR' && meRole !== 'TEACHER') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      return;
    }

    // Atualiza user com dados mais completos (emailVerified, mustChangePassword, etc.)
    // Mantém seu padrão de persistir `user` no LS
    const mergedUser = {
      ...(data.user || {}),
      ...(me || {}),
    };
    localStorage.setItem(LS.user, JSON.stringify(mergedUser));

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);

    if (mergedUser?.mustChangePassword) {
      window.location.replace('trocar-senha.html');
      return;
    }

    window.location.replace('professor-salas.html');
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
  } finally {
    disable(loginBtn, false);
  }
}

async function reenviarVerificacao() {
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
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

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  const pass = document.getElementById('password');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  if (justLoggedOutGuard()) return;

  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  // Se já está logado como professor, manda para o painel (ou trocar senha)
  if (token && (role === 'PROFESSOR' || role === 'TEACHER')) {
    if (user?.mustChangePassword) {
      window.location.replace('trocar-senha.html');
    } else {
      window.location.replace('professor-salas.html');
    }
    return;
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
