// login-professor.js (refatorado p/ padrão auth.js)
// - usa auth.js (notify + clearAuth + getToken/getUser + isProfessorSession + readErrorMessage)
// - mantém resend verify e cadastro
// - evita loops de redirect (mk_just_logged_out)

import { API_URL } from './config.js';
import {
  notify,
  clearAuth,
  getToken,
  getUser,
  isProfessorSession,
  readErrorMessage,
} from './auth.js';

const LS_LEGACY = {
  professorName: 'professorName',
  professorEmail: 'professorEmail',
  studentId: 'studentId',
  professorId: 'professorId',
};

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

function getLoginEmail() {
  return (emailLoginEl?.value || '').trim().toLowerCase();
}

function clearLegacyProfessorFields() {
  localStorage.removeItem(LS_LEGACY.professorName);
  localStorage.removeItem(LS_LEGACY.professorEmail);
}

function justLoggedOutGuard() {
  if (sessionStorage.getItem('mk_just_logged_out') === '1') {
    sessionStorage.removeItem('mk_just_logged_out');
    // limpa tudo (padrão novo)
    clearAuth();
    // limpa restos legados, se existirem
    clearLegacyProfessorFields();
    return true;
  }
  return false;
}

// ✅ Auto-redirect (apenas se já estiver logado como professor)
(function autoRedirectIfLogged() {
  if (justLoggedOutGuard()) return;

  // usa fonte da verdade
  const token = getToken();
  const user = getUser();

  // evita depender apenas de token: isProfessorSession valida role e faz compat professorId
  if (token && user && isProfessorSession({ allowCompatIdOnly: false })) {
    window.location.replace('professor-salas.html');
  }
})();

// -------------------------
// ✅ LOGIN (Auth)
// -------------------------
async function fazerLoginProfessor() {
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
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    // ✅ mesmo endpoint do aluno: lê erro/ok com helper seguro
    if (!res.ok) {
      const msg = await readErrorMessage(res, 'Login inválido.');

      // tenta inferir emailVerified=false pelo corpo (se vier no JSON)
      let emailVerified = null;
      try {
        const data = await res.clone().json();
        if (typeof data?.emailVerified === 'boolean') emailVerified = data.emailVerified;
      } catch {}

      if (emailVerified === false) {
        show(resendVerifyBtn, true);
        notify(
          'warn',
          'E-mail não confirmado',
          'Confirme seu e-mail para acessar. Se precisar, clique em “Reenviar verificação”.'
        );
      } else {
        notify('error', 'Não foi possível entrar', msg);
      }
      return;
    }

    const data = await res.json().catch(() => null);

    // contrato esperado: { ok, token, user, emailVerified? }
    if (!data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Login inválido.';
      notify('error', 'Não foi possível entrar', msg);
      return;
    }

    // garante que é professor
    const role = String(data?.user?.role || '').trim().toUpperCase();
    if (role !== 'PROFESSOR' && role !== 'TEACHER') {
      clearAuth();
      clearLegacyProfessorFields();
      notify('error', 'Acesso negado', 'Este acesso é apenas para professores.');
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      clearAuth();
      clearLegacyProfessorFields();
      notify('error', 'Erro', 'Login ok, mas o servidor não retornou o ID do professor.');
      return;
    }

    // limpa possíveis restos de login de aluno (compat)
    localStorage.removeItem(LS_LEGACY.studentId);

    // grava auth (padrão novo)
    localStorage.setItem('token', String(data.token));
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('professorId', String(userId)); // compat

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    window.location.replace('professor-salas.html');
  } catch (e) {
    console.error(e);
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
  } finally {
    disable(loginBtn, false);
  }
}

if (loginBtn) loginBtn.addEventListener('click', fazerLoginProfessor);

if (passLoginEl) {
  passLoginEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLoginProfessor();
  });
}

// -------------------------
// ✅ REENVIAR VERIFICAÇÃO
// -------------------------
async function reenviarVerificacao() {
  const email = getLoginEmail();
  if (!email) {
    notify(
      'warn',
      'Digite seu e-mail',
      'Informe seu e-mail no campo de login para reenviar o link.'
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

    if (!res.ok) {
      const msg = await readErrorMessage(
        res,
        'Não foi possível reenviar. Tente novamente em instantes.'
      );
      notify('error', 'Não foi possível reenviar', msg);
      return;
    }

    const data = await res.json().catch(() => null);
    if (data && data?.ok === false) {
      notify(
        'error',
        'Não foi possível reenviar',
        data?.message || data?.error || 'Tente novamente em instantes.'
      );
      return;
    }

    notify('success', 'Link enviado', 'Verifique a caixa de entrada e o Spam.');
    show(resendVerifyBtn, false);
  } catch (e) {
    console.error(e);
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

if (resendVerifyBtn) {
  show(resendVerifyBtn, false);
  resendVerifyBtn.addEventListener('click', reenviarVerificacao);
}

// -------------------------
// ✅ CADASTRO PROFESSOR
// -------------------------
async function cadastrarProfessor() {
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
    const res = await fetch(`${API_URL}/users/professor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const msg = await readErrorMessage(
        res,
        'Erro ao cadastrar professor. Tente outro e-mail.'
      );
      notify('error', 'Não foi possível cadastrar', msg);
      return;
    }

    const data = await res.json().catch(() => null);
    if (data && data?.ok === false) {
      notify(
        'error',
        'Não foi possível cadastrar',
        data?.message || data?.error || 'Erro ao cadastrar professor. Tente outro e-mail.'
      );
      return;
    }

    notify(
      'success',
      'Cadastro criado!',
      'Enviamos um link de verificação para seu e-mail. Confirme a conta para poder entrar.',
      4200
    );

    if (emailLoginEl) emailLoginEl.value = email;

    if (nameRegEl) nameRegEl.value = '';
    if (emailRegEl) emailRegEl.value = '';
    if (passRegEl) passRegEl.value = '';
  } catch (e) {
    console.error(e);
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(registerBtn, false);
  }
}

if (registerBtn) registerBtn.addEventListener('click', cadastrarProfessor);
