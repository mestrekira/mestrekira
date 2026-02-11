// login-professor.js
import { API_URL } from './config.js';

const status = document.getElementById('status');

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const resendVerifyBtn = document.getElementById('resendVerifyBtn');

const emailLoginEl = document.getElementById('emailLogin');
const passLoginEl = document.getElementById('passwordLogin');

const nameRegEl = document.getElementById('nameRegister');
const emailRegEl = document.getElementById('emailRegister');
const passRegEl = document.getElementById('passwordRegister');

// helpers
function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase(); // PROFESSOR / STUDENT
}

function getLoginEmail() {
  return (emailLoginEl?.value || '').trim().toLowerCase();
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

// ✅ Se já estiver logado com token, vai direto (MAS não após logout)
(function autoRedirectIfLogged() {
  if (justLoggedOutGuard()) return;

  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  try {
    const user = userJson ? JSON.parse(userJson) : null;
    const role = normalizeRole(user?.role);

    if (token && role === 'PROFESSOR') {
      window.location.replace('professor-salas.html');
    }
  } catch {
    // ignora
  }
})();

// -------------------------
// ✅ LOGIN (Auth)
// -------------------------
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const email = getLoginEmail();
    const password = passLoginEl?.value || '';

    show(resendVerifyBtn, false);

    if (!email || !password) {
      setStatus('Preencha e-mail e senha.');
      return;
    }

    setStatus('Entrando...');
    disable(loginBtn, true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      // ❌ erro (inclui "email não verificado")
      if (!response.ok || !data?.ok || !data?.token || !data?.user) {
        const msg = data?.error || 'Login inválido.';

        // se veio flag de não verificado, libera botão de reenvio
        if (data?.emailVerified === false) {
          show(resendVerifyBtn, true);
        }

        setStatus(msg);
        return;
      }

      const role = normalizeRole(data.user.role);

      // ✅ garante que é professor
      if (role !== 'PROFESSOR') {
        // limpa pra não ficar “logado” errado
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');

        setStatus('Este acesso é apenas para professores.');
        return;
      }

      // ✅ limpa possíveis restos de login de aluno
      localStorage.removeItem('studentId');

      // ✅ novo padrão (token + user)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ✅ compatibilidade com seu sistema antigo
      localStorage.setItem('professorId', data.user.id);

      window.location.replace('professor-salas.html');
    } catch {
      setStatus('Erro ao fazer login. Verifique seus dados.');
    } finally {
      disable(loginBtn, false);
    }
  });
}

// -------------------------
// ✅ REENVIAR VERIFICAÇÃO
// -------------------------
if (resendVerifyBtn) {
  resendVerifyBtn.addEventListener('click', async () => {
    const email = getLoginEmail();
    if (!email) {
      setStatus('Digite seu e-mail no campo de login para reenviar o link.');
      return;
    }

    setStatus('Reenviando link de verificação...');
    disable(resendVerifyBtn, true);

    try {
      const response = await fetch(`${API_URL}/auth/request-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setStatus(
          data?.message || data?.error || 'Não foi possível reenviar agora.',
        );
        return;
      }

      setStatus(
        'Pronto! Enviamos um novo link. Verifique a caixa de entrada e o Spam.',
      );
      show(resendVerifyBtn, false);
    } catch {
      setStatus('Erro ao reenviar o link. Tente novamente.');
    } finally {
      disable(resendVerifyBtn, false);
    }
  });
}

// -------------------------
// ✅ CADASTRO (Users -> Auth dispara e-mail)
// -------------------------
if (registerBtn) {
  registerBtn.addEventListener('click', async () => {
    const name = (nameRegEl?.value || '').trim();
    const email = (emailRegEl?.value || '').trim().toLowerCase();
    const password = passRegEl?.value || '';

    show(resendVerifyBtn, false);

    if (!name || !email || !password) {
      setStatus('Preencha nome, e-mail e senha.');
      return;
    }

    if (password.length < 8) {
      setStatus('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setStatus('Cadastrando...');
    disable(registerBtn, true);

    try {
      const response = await fetch(`${API_URL}/users/professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setStatus(
          data?.message ||
            data?.error ||
            'Erro ao cadastrar professor. Tente outro e-mail.',
        );
        return;
      }

      // ✅ NÃO loga automaticamente: precisa verificar e-mail
      setStatus(
        'Cadastro criado! Enviamos um link de verificação para seu e-mail. Confirme a conta para poder entrar.',
      );

      // pré-preenche login (ajuda)
      if (emailLoginEl) emailLoginEl.value = email;

      // limpa campos de cadastro
      if (nameRegEl) nameRegEl.value = '';
      if (emailRegEl) emailRegEl.value = '';
      if (passRegEl) passRegEl.value = '';
    } catch {
      setStatus('Erro ao cadastrar professor. Tente outro e-mail.');
    } finally {
      disable(registerBtn, false);
    }
  });
}
