import { API_URL } from './config.js';

const emailEl = document.getElementById('adminEmail');
const passEl = document.getElementById('adminPass');
const btnEl = document.getElementById('adminLoginBtn');
const clearEl = document.getElementById('adminClearBtn');
const statusEl = document.getElementById('adminStatus');

const ADMIN_TOKEN_KEY = 'mk_admin_token';

function setStatus(t) {
  statusEl.textContent = t || '';
}

function setLoading(on) {
  btnEl.disabled = !!on;
  clearEl.disabled = !!on;
  btnEl.textContent = on ? 'Entrando...' : 'Entrar';
}

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setToken(token) {
  if (!token) localStorage.removeItem(ADMIN_TOKEN_KEY);
  else localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

async function validateExistingToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setToken('');
      return false;
    }

    return true;
  } catch {
    // se API estiver fora, não redireciona (evita loop)
    return false;
  }
}

async function login() {
  const email = String(emailEl.value || '').trim().toLowerCase();
  const password = String(passEl.value || '');

  if (!email || !email.includes('@') || !password) {
    setStatus('Informe e-mail e senha.');
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

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus(data?.message || 'Falha no login.');
      return;
    }

    setToken(data?.token || '');
    window.location.href = 'admin.html';
  } catch {
    setStatus('Erro de conexão. Verifique a API/Render.');
  } finally {
    setLoading(false);
  }
}

function clear() {
  emailEl.value = '';
  passEl.value = '';
  setStatus('');
  emailEl.focus();
}

btnEl?.addEventListener('click', login);
clearEl?.addEventListener('click', clear);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !btnEl.disabled) login();
});

// ✅ Evita loop: só vai pro painel se o token for válido
(async () => {
  const ok = await validateExistingToken();
  if (ok) window.location.href = 'admin.html';
})();
