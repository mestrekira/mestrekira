import { API_URL } from './config.js';

const formEl = document.getElementById('adminLoginForm');
const emailEl = document.getElementById('adminEmail');
const passEl = document.getElementById('adminPass');
const btnEl = document.getElementById('adminLoginBtn');
const clearEl = document.getElementById('adminClearBtn');
const statusEl = document.getElementById('adminStatus');

const ADMIN_TOKEN_KEY = 'mk_admin_token';
const ADMIN_USER_KEY = 'mk_admin_user';

function setStatus(text = '') {
  if (statusEl) statusEl.textContent = text;
}

function setLoading(on) {
  if (btnEl) btnEl.disabled = !!on;
  if (clearEl) clearEl.disabled = !!on;
  if (emailEl) emailEl.disabled = !!on;
  if (passEl) passEl.disabled = !!on;
  if (btnEl) btnEl.textContent = on ? 'Entrando...' : 'Entrar';
}

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setToken(token) {
  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function setAdminUser(user) {
  if (!user) {
    localStorage.removeItem(ADMIN_USER_KEY);
    return;
  }
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function validateExistingToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearSession();
      return false;
    }

    const data = await readJsonSafe(res);
    if (data) setAdminUser(data);

    return true;
  } catch {
    return false;
  }
}

async function login(event) {
  event?.preventDefault();

  const email = String(emailEl?.value || '').trim().toLowerCase();
  const password = String(passEl?.value || '');

  if (!email || !password) {
    setStatus('Informe e-mail e senha.');
    return;
  }

  if (!isValidEmail(email)) {
    setStatus('Informe um e-mail válido.');
    emailEl?.focus();
    return;
  }

  setLoading(true);
  setStatus('Autenticando...');

  try {
    const res = await fetch(`${API_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
      setStatus(data?.message || data?.error || 'Falha no login.');
      return;
    }

    if (!data?.token) {
      setStatus('Resposta inválida do servidor.');
      return;
    }

    setToken(data.token);
    setAdminUser(data?.admin || data?.user || null);
    setStatus('Login realizado com sucesso.');

    window.location.href = 'admin.html';
  } catch {
    setStatus('Erro de conexão. Verifique a API.');
  } finally {
    setLoading(false);
  }
}

function clearForm() {
  if (emailEl) emailEl.value = '';
  if (passEl) passEl.value = '';
  setStatus('');
  emailEl?.focus();
}

formEl?.addEventListener('submit', login);
btnEl?.addEventListener('click', login);
clearEl?.addEventListener('click', clearForm);

(async function init() {
  if (!emailEl || !passEl || !btnEl || !clearEl || !statusEl) return;

  const ok = await validateExistingToken();
  if (ok) {
    window.location.href = 'admin.html';
    return;
  }

  emailEl.focus();
})();
