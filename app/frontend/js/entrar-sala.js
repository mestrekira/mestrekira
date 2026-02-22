// entrar-sala.js (refatorado / padrão authFetch + token)
// - entra na sala pelo CÓDIGO (sem criar/logar aqui)
// - exige sessão de aluno (token + user.role), com compatibilidade de studentId
// - trata 401/403 com redirect limpo para login-aluno.html

import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// =====================
// Toast helper (não quebra se toast não existir)
// =====================
function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } catch {
    if (type === 'error') console.error(title, message);
  }
}

// =====================
// Sessão / Auth helpers
// =====================
function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

function getStudentIdCompat() {
  const id = localStorage.getItem('studentId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

function isStudentSession() {
  const token = localStorage.getItem('token') || '';
  const userJson = localStorage.getItem('user');
  if (!token || !userJson) return false;

  try {
    const user = JSON.parse(userJson);
    const role = normRole(user?.role);

    // aceita STUDENT e ALUNO (compatibilidade)
    if (role !== 'STUDENT' && role !== 'ALUNO') return false;

    // garante studentId compatível com páginas antigas
    if (user?.id && !getStudentIdCompat()) {
      localStorage.setItem('studentId', String(user.id));
    }

    return true;
  } catch {
    return false;
  }
}

function getToken() {
  return localStorage.getItem('token') || '';
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-aluno.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

async function errorMessageFromResponse(res) {
  // tenta json -> texto
  try {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const m = data?.message ?? data?.error;
      if (Array.isArray(m)) return m.join(' | ');
      if (typeof m === 'string' && m.trim()) return m;
    }
  } catch {
    // ignora
  }

  try {
    const t = await res.text().catch(() => '');
    if (t && t.trim()) return t.slice(0, 300);
  } catch {
    // ignora
  }

  return `Erro (HTTP ${res.status}).`;
}

// =====================
// ELEMENTOS
// =====================
const statusEl = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');
const codeEl = document.getElementById('code');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function setBusy(busy) {
  if (enterBtn) enterBtn.disabled = !!busy;
  if (codeEl) codeEl.disabled = !!busy;
}

// =====================
// Guard inicial
// =====================
if (!isStudentSession()) {
  clearAuth();
  window.location.replace('login-aluno.html');
  throw new Error('Sessão de aluno ausente/inválida');
}

const studentId = getStudentIdCompat();
if (!studentId) {
  clearAuth();
  window.location.replace('login-aluno.html');
  throw new Error('studentId ausente/inválido');
}

// =====================
// Entrar na sala
// =====================
async function entrar() {
  const code = (codeEl?.value || '').trim().toUpperCase();

  if (!code) {
    setStatus('Informe o código da sala.');
    notify('warn', 'Campo obrigatório', 'Informe o código da sala.');
    return;
  }

  setBusy(true);
  setStatus('Entrando na sala...');

  try {
    const res = await authFetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      body: JSON.stringify({ code, studentId }),
    });

    if (!res.ok) {
      const msg = await errorMessageFromResponse(res);
      notify('error', 'Não foi possível entrar', msg);
      setStatus('Erro ao entrar na sala. Verifique o código.');
      setBusy(false);
      return;
    }

    const data = await res.json().catch(() => null);
    const roomId = data?.roomId ? String(data.roomId) : '';

    if (!roomId) {
      notify('error', 'Resposta inválida', 'O servidor não retornou o ID da sala.');
      setStatus('Não foi possível abrir a sala agora.');
      setBusy(false);
      return;
    }

    setStatus('Tudo certo! Abrindo sala...');
    window.location.replace(`sala-aluno.html?roomId=${encodeURIComponent(roomId)}`);
  } catch (e) {
    // AUTH_* já redireciona
    if (!String(e?.message || '').startsWith('AUTH_')) {
      console.error(e);
      notify('error', 'Erro', 'Não foi possível acessar o servidor agora.');
      setStatus('Erro ao entrar na sala.');
      setBusy(false);
    }
  }
}

if (enterBtn) enterBtn.addEventListener('click', entrar);

if (codeEl) {
  codeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrar();
  });
}
