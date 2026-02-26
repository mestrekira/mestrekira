import { API_URL } from './config.js';

const $ = (id) => document.getElementById(id);

const emailEl = $('email');
const passEl = $('password');
const btn = $('btnLogin');
const statusEl = $('status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

async function login() {
  const email = String(emailEl?.value || '').trim();
  const password = String(passEl?.value || '');

  if (!email || !password) {
    setStatus('Preencha e-mail e senha.');
    return;
  }

  btn.disabled = true;
  setStatus('Entrando...');

  try {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();

    if (!data?.ok) {
      setStatus(data?.error || 'Falha no login.');
      btn.disabled = false;
      return;
    }

    // ✅ garante role school
    if (String(data?.user?.role || '').toLowerCase() !== 'school') {
      setStatus('Este login é exclusivo para escola.');
      btn.disabled = false;
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('role', data.user.role);

    // escola não usa mustChangePassword normalmente
    window.location.href = 'painel-escola.html';
  } catch (e) {
    setStatus('Erro ao conectar.');
    btn.disabled = false;
  }
}

btn?.addEventListener('click', login);
