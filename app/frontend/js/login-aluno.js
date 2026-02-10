import { API_URL } from './config.js';

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg || '';
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
  const emailEl = document.getElementById('email');
  return (emailEl?.value || '').trim().toLowerCase();
}

async function fazerLogin() {
  const passEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  const email = getEmail();
  const password = passEl?.value || '';

  setError('');
  show(resendVerifyBtn, false);

  if (!email || !password) {
    setError('Preencha e-mail e senha.');
    return;
  }

  disable(loginBtn, true);
  setError('Entrando...');

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
      }

      setError(msg);
      disable(loginBtn, false);
      return;
    }

    const role = normRole(data.user.role);

    // evita conflito de papéis
    localStorage.removeItem('professorId');
    localStorage.removeItem('studentId');

    // ✅ padrão novo (token + user)
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // ✅ compatibilidade com seu padrão antigo
    localStorage.setItem('studentId', data.user.id);

    // ✅ se por algum motivo for professor, manda para painel de professor
    if (role === 'PROFESSOR') {
      localStorage.setItem('professorId', data.user.id);
      window.location.replace('professor-salas.html');
      return;
    }

    window.location.replace('painel-aluno.html');
  } catch {
    setError('Erro ao fazer login. Tente novamente.');
  } finally {
    disable(loginBtn, false);
  }
}

async function reenviarVerificacao() {
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
  const email = getEmail();

  setError('');

  if (!email) {
    setError('Digite seu e-mail para reenviar o link.');
    return;
  }

  disable(resendVerifyBtn, true);
  setError('Reenviando link de verificação...');

  try {
    const res = await fetch(`${API_URL}/auth/request-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setError(data?.message || data?.error || 'Não foi possível reenviar agora.');
      disable(resendVerifyBtn, false);
      return;
    }

    setError('Pronto! Enviamos um novo link. Verifique a caixa de entrada e o Spam.');
    show(resendVerifyBtn, false);
  } catch {
    setError('Erro ao reenviar o link. Tente novamente.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  const pass = document.getElementById('password');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  // ✅ Se já estiver logado com token e for STUDENT, vai direto
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  try {
    const user = userJson ? JSON.parse(userJson) : null;
    if (token && normRole(user?.role) === 'STUDENT') {
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
