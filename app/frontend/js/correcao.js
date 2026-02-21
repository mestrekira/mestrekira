// correcao.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// -------------------- Toast helpers --------------------
function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration:
      duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function setStatus(msg) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg || '';
}

// -------------------- Session / Auth helpers --------------------
const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
};

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuth() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function requireProfessorSession() {
  const token = localStorage.getItem(LS.token) || '';
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || role !== 'PROFESSOR') {
    clearAuth();
    notify('warn', 'Sessão necessária', 'Faça login como professor para continuar.', 3200);
    setTimeout(() => window.location.replace('login-professor.html'), 400);
    throw new Error('Sessão inválida (professor)');
  }

  // compatibilidade
  if (user?.id) localStorage.setItem(LS.professorId, String(user.id));
  localStorage.removeItem(LS.studentId);

  return { token, user };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function unwrapResult(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (data.result && typeof data.result === 'object') return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return data.data;
  }
  return data;
}

async function apiFetch(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    notify('
