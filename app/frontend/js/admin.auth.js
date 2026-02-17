import { API_URL } from './config.js';

const emailEl = document.getElementById('adminEmail');
const passEl = document.getElementById('adminPass');
const btnEl = document.getElementById('adminLoginBtn');
const clearEl = document.getElementById('adminClearBtn');
const statusEl = document.getElementById('adminStatus');

const ADMIN_TOKEN_KEY = 'mk_admin_token';

function setStatus(t){ statusEl.textContent = t || ''; }

async function login() {
  const email = String(emailEl.value || '').trim().toLowerCase();
  const password = String(passEl.value || '');

  if (!email || !email.includes('@') || !password) {
    setStatus('Informe e-mail e senha.');
    return;
  }

  setStatus('Entrando...');

  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    setStatus(data?.message || 'Falha no login.');
    return;
  }

  localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
  window.location.href = 'admin.html';
}

function clear() {
  emailEl.value = '';
  passEl.value = '';
  setStatus('');
}

btnEl?.addEventListener('click', login);
clearEl?.addEventListener('click', clear);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});

// Se já tiver token, manda pro painel
if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
  window.location.href = 'admin.html';
}
