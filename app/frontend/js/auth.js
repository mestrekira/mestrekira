// auth.js
// Utilitário único de autenticação para front (aluno/professor)

import { toast } from './ui-feedback.js';

// ---------- toast safe ----------
function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } catch {
    if (type === 'error') console.error(title, message);
  }
}

// ---------- helpers ----------
function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function getUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// compat IDs antigos (enquanto você migra)
export function getStudentIdCompat() {
  const id = localStorage.getItem('studentId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

export function getProfessorIdCompat() {
  const id = localStorage.getItem('professorId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

export function isStudentSession({ allowCompatIdOnly = true } = {}) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return allowCompatIdOnly ? !!getStudentIdCompat() : false;
  }

  const role = normRole(user?.role);
  const ok = role === 'STUDENT' || role === 'ALUNO';

  if (ok && user?.id && !getStudentIdCompat()) {
    localStorage.setItem('studentId', String(user.id));
  }

  return ok;
}

export function isProfessorSession({ allowCompatIdOnly = true } = {}) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return allowCompatIdOnly ? !!getProfessorIdCompat() : false;
  }

  const role = normRole(user?.role);
  const ok = role === 'PROFESSOR' || role === 'TEACHER';

  if (ok && user?.id && !getProfessorIdCompat()) {
    localStorage.setItem('professorId', String(user.id));
  }

  return ok;
}

// ---------- authFetch ----------
export async function authFetch(url, options = {}) {
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
    setTimeout(() => {
      // se quiser diferenciar professor/aluno depois, a gente ajusta
      window.location.replace('login.html');
    }, 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

// ---------- util: leitura de erro ----------
export async function readErrorMessage(res, fallback) {
  let msg = fallback || `HTTP ${res.status}`;
  try {
    const data = await res.json();
    const m = data?.message ?? data?.error;
    if (Array.isArray(m)) msg = m.join(' | ');
    else if (typeof m === 'string' && m.trim()) msg = m;
  } catch {
    try {
      const t = await res.text();
      if (t && t.trim()) msg = t.slice(0, 300);
    } catch {}
  }
  return msg;
}
