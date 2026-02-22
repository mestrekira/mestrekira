// auth.js (final / prático)
// Utilitário único de autenticação para front (aluno/professor)

import { toast } from './ui-feedback.js';

// ---------- toast safe ----------
export function notify(type, title, message, duration) {
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

// compat IDs antigos
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

export function isStudentSession({ allowCompatIdOnly = false } = {}) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) return allowCompatIdOnly ? !!getStudentIdCompat() : false;

  const role = normRole(user?.role);
  const ok = role === 'STUDENT' || role === 'ALUNO';

  if (ok && user?.id && !getStudentIdCompat()) {
    localStorage.setItem('studentId', String(user.id));
  }
  return ok;
}

export function isProfessorSession({ allowCompatIdOnly = false } = {}) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) return allowCompatIdOnly ? !!getProfessorIdCompat() : false;

  const role = normRole(user?.role);
  const ok = role === 'PROFESSOR' || role === 'TEACHER';

  if (ok && user?.id && !getProfessorIdCompat()) {
    localStorage.setItem('professorId', String(user.id));
  }
  return ok;
}

// Decide para qual login mandar (sem você ter que lembrar)
function inferLoginPage() {
  const path = String(window.location.pathname || '').toLowerCase();

  // Se a URL/página contém "professor", assume ambiente professor
  if (path.includes('professor')) return 'login-professor.html';

  // Se a sessão atual for professor, manda pro professor
  const u = getUser();
  const r = normRole(u?.role);
  if (r === 'PROFESSOR' || r === 'TEACHER') return 'login-professor.html';

  // default: aluno
  return 'login-aluno.html';
}

// Guards práticos
export function requireStudentSession({ redirectTo = 'login-aluno.html' } = {}) {
  if (!isStudentSession()) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('Sessão de aluno ausente/inválida');
  }
  const sid = getStudentIdCompat();
  if (!sid) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('studentId ausente/inválido');
  }
  return sid;
}

export function requireProfessorSession({ redirectTo = 'login-professor.html' } = {}) {
  if (!isProfessorSession()) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('Sessão de professor ausente/inválida');
  }
  const pid = getProfessorIdCompat();
  if (!pid) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('professorId ausente/inválido');
  }
  return pid;
}

// ---------- authFetch ----------
export async function authFetch(url, options = {}, cfg = {}) {
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

    const redirectTo = cfg.redirectTo || inferLoginPage();
    setTimeout(() => window.location.replace(redirectTo), 600);

    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

// ---------- util: leitura de erro (sem "body already used") ----------
export async function readErrorMessage(res, fallback) {
  let msg = fallback || `HTTP ${res.status}`;

  // tenta JSON via clone (não consome o body do res principal)
  try {
    const data = await res.clone().json();
    const m = data?.message ?? data?.error;
    if (Array.isArray(m)) msg = m.join(' | ');
    else if (typeof m === 'string' && m.trim()) msg = m.trim();
    return msg;
  } catch {
    // ignora
  }

  // tenta texto via clone
  try {
    const t = await res.clone().text();
    if (t && t.trim()) msg = t.trim().slice(0, 300);
  } catch {}

  return msg;
}
