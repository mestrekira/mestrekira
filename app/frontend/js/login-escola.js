// login-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',

  // chaves já existentes no seu projeto (evitar conflito)
  studentId: 'studentId',
  professorId: 'professorId',

  // legados (se existirem)
  role: 'role',
  userId: 'userId',
};

const $ = (id) => document.getElementById(id);

const emailEl = $('email');
const passEl = $('password');
const btnLogin = $('btnLogin');
const statusEl = $('status');
const resendVerifyBtn = $('resendVerifyBtn');

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function show(el, value) {
  if (!el) return;
  el.style.display = value ? 'inline-block' : 'none';
}

function safeJsonParse(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.schoolId);

  // limpa conflitos/legados
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.role);
  localStorage.removeItem(LS.userId);
}

function justLoggedOutGuard() {
  if (sessionStorage.getItem('mk_just_logged_out') === '1') {
    sessionStorage.removeItem('mk_just_logged_out');
    clearAuthStorage();
    return true;
  }
  return false;
}

async function login() {
  const email = String(emailEl?.value || '').trim().toLowerCase();
  const password = String(passEl?.value || '');

  show(resendVerifyBtn, false);
  setStatus('');

  if (!email || !password) {
    notify('warn', 'Campos obrigatórios', 'Preencha e-mail e senha.');
    setStatus('Preencha e-mail e senha.');
    return;
  }

  disable(btnLogin, true);
  notify('info', 'Entrando...', 'Verificando seus dados...', 1800);
  setStatus('Entrando...');

  try {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonSafe(r);

    if (!data) {
      notify('error', 'Erro', 'Resposta inválida do servidor. Tente novamente.');
      setStatus('Resposta inválida do servidor.');
      return;
    }

    if (!r.ok || !data?.ok || !data?.token || !data?.user) {
      const msg = data?.message || data?.error || 'Falha no login.';

      // ✅ se backend sinaliza e-mail não verificado
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

    // ✅ garante role school
    if (role !== 'SCHOOL' && role !== 'ESCOLA') {
      clearAuthStorage();
      notify('error', 'Acesso negado', 'Este login é exclusivo para escolas.');
      setStatus('Este login é exclusivo para escola.');
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      clearAuthStorage();
      notify('error', 'Erro', 'Login ok, mas o servidor não retornou o ID.');
      setStatus('Erro: servidor não retornou o ID.');
      return;
    }

    // ✅ evita conflito de papéis
    localStorage.removeItem(LS.studentId);
    localStorage.removeItem(LS.professorId);

    // ✅ grava auth no padrão do projeto
    localStorage.setItem(LS.token, String(data.token));
    localStorage.setItem(LS.user, JSON.stringify(data.user));
    localStorage.setItem(LS.schoolId, String(userId));

    notify('success', 'Bem-vindo!', 'Login realizado com sucesso.', 1100);
    setStatus('');

    window.location.replace('painel-escola.html');
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro ao conectar.');
  } finally {
    disable(btnLogin, false);
  }
}

/**
 * ✅ Reenviar verificação
 * POST /auth/request-verify
 */
async function reenviarVerificacao() {
  const email = String(emailEl?.value || '').trim().toLowerCase();
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
    setStatus('Link de verificação reenviado.');
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(resendVerifyBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (justLoggedOutGuard()) return;

  // ✅ auto-redirect se já logado como escola
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (token && (role === 'SCHOOL' || role === 'ESCOLA')) {
    window.location.replace('painel-escola.html');
    return;
  }

  btnLogin?.addEventListener('click', login);

  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  resendVerifyBtn?.addEventListener('click', reenviarVerificacao);
  show(resendVerifyBtn, false);
});
