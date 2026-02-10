import { API_URL } from './config.js';

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

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

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    // ❌ erro (inclui "email não verificado")
    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.error || 'Login inválido.';

      if (data?.emailVerified === false) {
        show(resendVerifyBtn, true);
      }

      setError(msg);
      disable(loginBtn, false);
      return;
    }

    const role = normRole(data.user.role);

    // ✅ garante que é estudante
    if (role !== 'STUDENT') {
      setError('Este acesso é apenas para estudantes.');
      disable(loginBtn, false);
      return;
    }

    // evita conflito de papéis
    localStorage.removeItem('professorId');
    localStorage.removeItem('studentId');

    // ✅ novo padrão (token + user)
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // ✅ mantém compatibilidade com seu sistema antigo
    localStorage.setItem('studentId', data.user.id);

    window.location.replace('painel-aluno.html');
  } catch {
    setError('Erro ao fazer login. Tente novamente.');
    disable(loginBtn, false);
  }
}

// -------------------------
// ✅ REENVIAR VERIFICAÇÃO
// -------------------------
async function reenviarVerificacao() {
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');
  const email = getEmail();

  if (!email) {
    setError('Digite seu e-mail no campo de login para reenviar o link.');
    return;
  }

  setError('Reenviando link de verificação...');
  disable(resendVerifyBtn, true);

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
    disable(resendVerifyBtn, false);
  } catch {
    setError('Erro ao reenviar o link. Tente novamente.');
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  const pass = document.getElementById('password');
  const resendVerifyBtn = document.getElementById('resendVerifyBtn');

  // ✅ Se já estiver logado com token e for estudante, vai direto
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

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener('click', reenviarVerificacao);
  }

  if (pass) {
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }
});
