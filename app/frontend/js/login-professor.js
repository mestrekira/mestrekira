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

// ✅ Se já estiver logado com token, vai direto
const token = localStorage.getItem('token');
const userJson = localStorage.getItem('user');

try {
  const user = userJson ? JSON.parse(userJson) : null;
  if (token && user?.role && String(user.role).toUpperCase() === 'PROFESSOR') {
    window.location.replace('professor-salas.html');
  }
} catch {
  // ignora
}

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
        disable(loginBtn, false);
        return;
      }

      const role = normalizeRole(data.user.role);

      // ✅ garante que é professor
      if (role !== 'PROFESSOR') {
        setStatus('Este acesso é apenas para professores.');
        disable(loginBtn, false);
        return;
      }

      // ✅ limpa possíveis restos de login de aluno
      localStorage.removeItem('studentId');

      // ✅ novo padrão (token + user)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ✅ mantém compatibilidade com seu sistema antigo (se ainda usar professorId)
      localStorage.setItem('professorId', data.user.id);

      window.location.replace('professor-salas.html');
    } catch {
      setStatus('Erro ao fazer login. Verifique seus dados.');
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
        setStatus(data?.message || data?.error || 'Não foi possível reenviar agora.');
        disable(resendVerifyBtn, false);
        return;
      }

      setStatus('Pronto! Enviamos um novo link. Verifique a caixa de entrada e o Spam.');
      show(resendVerifyBtn, false);
      disable(resendVerifyBtn, false);
    } catch {
      setStatus('Erro ao reenviar o link. Tente novamente.');
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
      // ✅ mantém seu endpoint atual (/users/professor)
      // (ele chama AuthService.registerProfessor por trás, que envia o e-mail)
      const response = await fetch(`${API_URL}/users/professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setStatus(data?.message || data?.error || 'Erro ao cadastrar professor. Tente outro e-mail.');
        disable(registerBtn, false);
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

      disable(registerBtn, false);
    } catch {
      setStatus('Erro ao cadastrar professor. Tente outro e-mail.');
      disable(registerBtn, false);
    }
  });
}
