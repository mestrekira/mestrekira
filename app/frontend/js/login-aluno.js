// login-aluno.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',
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
    duration:
      duration ??
      (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
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
  // limpa tudo que pode gerar conflitos/loops
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);
}

function justLoggedOutGuard() {
  // evita loop quando acabou de fazer logout e caiu no login
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
      // evita enviar espaços sem querer
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await readJsonSafe(res);

    // Se API caiu/retornou HTML/sem JSON, cai aqui
    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor. Tente novamente.');
      return;
    }

    // erro (inclui "email não verificado")
    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg =
        data?.message ||
        data?.error ||
        'Usuário ou senha inválidos.';

      // padrão específico (seu backend pode mandar emailVerified=false)
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

    // bloqueia se não for STUDENT/ALUNO
    if (role !== 'STUDENT' && role !== 'ALUNO') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este acesso é apenas para estudantes.');
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem(LS.professorId);

    // grava auth (padrão novo)
    localStorage.setItem(LS.token, String(data.token));
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.studentId, String(data.user.id));

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    window.location.replace('painel-aluno.html');
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

  // evita looping pós-logout
  if (justLoggedOutGuard()) return;

  // Se já estiver logado com token e for STUDENT/ALUNO, vai direto.
  // Obs.: aqui é só atalho UX. Se token expirou, o painel deve lidar.
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (token && (role === 'STUDENT' || role === 'ALUNO')) {
    window.location.replace('painel-aluno.html');
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
    // começa oculto por padrão
    show(resendVerifyBtn, false);
  }
});
