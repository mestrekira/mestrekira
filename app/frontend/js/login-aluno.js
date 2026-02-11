// login-aluno.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

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

function justLoggedOutGuard() {
  // ✅ evita loop quando acabou de fazer logout e caiu no login
  if (sessionStorage.getItem('mk_just_logged_out') === '1') {
    sessionStorage.removeItem('mk_just_logged_out');

    // limpa TUDO que pode causar auto-redirect
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('professorId');
    localStorage.removeItem('studentId');

    return true;
  }
  return false;
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
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    // ❌ erro (inclui "email não verificado")
    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.error || 'Usuário ou senha inválidos.';

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

    // ✅ bloqueia se não for STUDENT/ALUNO
    if (role !== 'STUDENT' && role !== 'ALUNO') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('professorId');
      localStorage.removeItem('studentId');

      notify('error', 'Acesso negado', 'Este acesso é apenas para estudantes.');
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem('professorId');

    // ✅ padrão novo (token + user)
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // ✅ compatibilidade
    localStorage.setItem('studentId', data.user.id);

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1200);
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

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      notify(
        'error',
        'Não foi possível reenviar',
        data?.message || data?.error || 'Tente novamente em instantes.',
      );
      return;
    }

    notify(
      'success',
      'Link enviado',
      'Verifique a caixa de entrada e o Spam.',
    );
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

  // ✅ evita looping pós-logout
  if (justLoggedOutGuard()) return;

  // ✅ Se já estiver logado com token e for STUDENT/ALUNO, vai direto
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  try {
    const user = userJson ? JSON.parse(userJson) : null;
    const role = normRole(user?.role);

    if (token && (role === 'STUDENT' || role === 'ALUNO')) {
      window.location.replace('painel-aluno.html');
      return;
    }
  } catch {
    // ignora
  }

  if (btn) btn.addEventListener('click', fazerLogin);

  if (pass) {
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
  }
});
