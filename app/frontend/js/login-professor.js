// login-professor.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const resendVerifyBtn = document.getElementById('resendVerifyBtn');

const emailLoginEl = document.getElementById('emailLogin');
const passLoginEl = document.getElementById('passwordLogin');

const nameRegEl = document.getElementById('nameRegister');
const emailRegEl = document.getElementById('emailRegister');
const passRegEl = document.getElementById('passwordRegister');

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
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
      notify('warn', 'Campos obrigatórios', 'Preencha e-mail e senha.');
      return;
    }

    disable(loginBtn, true);
    notify('info', 'Entrando...', 'Verificando seus dados...', 1800);

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

      const role = normalizeRole(data.user.role);

      // ✅ garante que é professor
      if (role !== 'PROFESSOR') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');

        notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
        return;
      }

      // ✅ limpa possíveis restos de login de aluno
      localStorage.removeItem('studentId');

      // ✅ novo padrão (token + user)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ✅ compatibilidade
      localStorage.setItem('professorId', data.user.id);

      notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1200);
      window.location.replace('professor-salas.html');
    } catch {
      notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
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
      notify(
        'warn',
        'Digite seu e-mail',
        'Informe seu e-mail no campo de login para reenviar o link.',
      );
      return;
    }

    disable(resendVerifyBtn, true);
    notify('info', 'Reenviando...', 'Enviando novo link de verificação...', 1800);

    try {
      const response = await fetch(`${API_URL}/auth/request-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
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
      notify('warn', 'Campos obrigatórios', 'Preencha nome, e-mail e senha.');
      return;
    }

    if (password.length < 8) {
      notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    disable(registerBtn, true);
    notify('info', 'Cadastrando...', 'Criando sua conta...', 1800);

    try {
      const response = await fetch(`${API_URL}/users/professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        notify(
          'error',
          'Não foi possível cadastrar',
          data?.message ||
            data?.error ||
            'Erro ao cadastrar professor. Tente outro e-mail.',
        );
        return;
      }

      notify(
        'success',
        'Cadastro criado!',
        'Enviamos um link de verificação para seu e-mail. Confirme a conta para poder entrar.',
        4200,
      );

      // pré-preenche login (ajuda)
      if (emailLoginEl) emailLoginEl.value = email;

      // limpa campos de cadastro
      if (nameRegEl) nameRegEl.value = '';
      if (emailRegEl) emailRegEl.value = '';
      if (passRegEl) passRegEl.value = '';
    } catch {
      notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
    } finally {
      disable(registerBtn, false);
    }
  });
}
