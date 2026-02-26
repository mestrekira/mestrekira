// trocar-senha.js
import { API_URL } from './config.js';

const $ = (id) => document.getElementById(id);

function notify(type, title, message) {
  if (typeof window.notify === 'function') return window.notify(type, title, message);

  const prefix =
    type === 'success' ? '✅ ' :
    type === 'error' ? '❌ ' :
    type === 'warn' ? '⚠️ ' : 'ℹ️ ';
  alert(`${prefix}${title}\n\n${message}`);
}

function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg || '';
}

function setBusy(isBusy) {
  const btn = $('btnSave');
  if (btn) {
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? 'Salvando...' : 'Salvar senha';
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      text ||
      `Erro HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return data;
}

function getSession() {
  const token = String(localStorage.getItem('token') || '').trim();
  const userId = String(localStorage.getItem('userId') || '').trim();
  const role = String(localStorage.getItem('role') || '').trim().toLowerCase();
  return { token, userId, role };
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('role');
  // volta pro login do professor
  window.location.href = 'login-professor.html';
}

async function bootstrap() {
  const { token, userId, role } = getSession();

  if (!token || !userId) {
    notify('warn', 'Sessão expirada', 'Faça login novamente.');
    window.location.href = 'login-professor.html';
    return;
  }

  // opcional: confirma role/professor
  try {
    const me = await api(`/users/${encodeURIComponent(userId)}`, { token });
    const meRole = String(me?.role || role || '').toLowerCase();

    if (meRole !== 'professor') {
      notify('error', 'Acesso negado', 'Esta área é exclusiva para professores.');
      logout();
      return;
    }

    // Se já não precisa trocar, manda pro painel
    if (!me?.mustChangePassword) {
      window.location.href = 'professor-salas.html';
      return;
    }
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
    logout();
  }
}

async function savePassword() {
  const { token, userId } = getSession();

  if (!token || !userId) {
    notify('warn', 'Sessão expirada', 'Faça login novamente.');
    window.location.href = 'login-professor.html';
    return;
  }

  const p1 = String($('newPassword')?.value || '');
  const p2 = String($('confirmPassword')?.value || '');

  if (!p1 || !p2) {
    notify('warn', 'Campos obrigatórios', 'Preencha a nova senha e a confirmação.');
    return;
  }

  if (p1.length < 8) {
    notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
    return;
  }

  if (p1 !== p2) {
    notify('warn', 'Senhas diferentes', 'A confirmação não confere.');
    return;
  }

  setBusy(true);
  setStatus('Atualizando senha...');
  try {
    // Seu UsersController já tem PATCH /users/:id com { password }
    await api(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      token,
      body: { password: p1 },
    });

    notify('success', 'Senha atualizada', 'Senha definida com sucesso.');

    // Após trocar, manda pro painel do professor
    window.location.href = 'professor-salas.html';
  } catch (e) {
    notify('error', 'Erro ao salvar', String(e?.message || e));
    setStatus('');
  } finally {
    setBusy(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap();

  const btnSave = $('btnSave');
  const btnLogout = $('btnLogout');

  if (btnSave) btnSave.addEventListener('click', savePassword);
  if (btnLogout) btnLogout.addEventListener('click', logout);

  const confirmEl = $('confirmPassword');
  if (confirmEl) {
    confirmEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') savePassword();
    });
  }
});
