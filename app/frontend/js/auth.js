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
      duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
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

// ---------- login redirect ----------
export function redirectToLogin(kind = 'student') {
  // kind: 'student' | 'professor' | 'auto'
  if (kind === 'professor') return window.location.replace('login-professor.html');
  if (kind === 'student') return window.location.replace('login-aluno.html');

  // auto: tenta inferir pelo role, senão cai em login-aluno
  const user = getUser();
  const role = normRole(user?.role);
  if (role === 'PROFESSOR' || role === 'TEACHER') {
    return window.location.replace('login-professor.html');
  }
  return window.location.replace('login-aluno.html');
}

// ---------- guards prontos (evita duplicação) ----------
export function requireStudent(loginPage = 'login-aluno.html') {
  if (!isStudentSession({ allowCompatIdOnly: false })) {
    clearAuth();
    window.location.replace(loginPage);
    throw new Error('Sessão de aluno ausente/inválida');
  }

  const studentId = getStudentIdCompat();
  if (!studentId) {
    clearAuth();
    window.location.replace(loginPage);
    throw new Error('studentId ausente/inválido');
  }

  return { studentId, user: getUser() };
}

export function requireProfessor(loginPage = 'login-professor.html') {
  if (!isProfessorSession({ allowCompatIdOnly: false })) {
    clearAuth();
    window.location.replace(loginPage);
    throw new Error('Sessão de professor ausente/inválida');
  }

  const professorId = getProfessorIdCompat();
  if (!professorId) {
    clearAuth();
    window.location.replace(loginPage);
    throw new Error('professorId ausente/inválido');
  }

  return { professorId, user: getUser() };
}

// ---------- util: leitura de erro (robusta) ----------
export async function readErrorMessage(res, fallback) {
  const msgFallback = fallback || `HTTP ${res.status}`;

  // lê o body UMA vez (robusto)
  let text = '';
  try {
    text = await res.text();
  } catch {
    return msgFallback;
  }

  const trimmed = (text || '').trim();
  if (!trimmed) return msgFallback;

  // tenta JSON.parse do texto
  try {
    const data = JSON.parse(trimmed);
    const m = data?.message ?? data?.error;
    if (Array.isArray(m)) return m.join(' | ');
    if (typeof m === 'string' && m.trim()) return m.trim();
    // se tiver outro formato, cai no texto
  } catch {
    // não é JSON
  }

  return trimmed.slice(0, 300);
}

// ---------- authFetch ----------
/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {object} cfg
 * @param {'student'|'professor'|'auto'|string} cfg.redirectTo
 *   - 'student' -> login-aluno.html
 *   - 'professor' -> login-professor.html
 *   - 'auto' -> decide por role
 *   - string -> usa como página (ex: 'login-aluno.html')
 * @param {boolean} cfg.silentAuthError - se true, não notifica toast
 */
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
    if (!cfg?.silentAuthError) {
      notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    }
    clearAuth();

    setTimeout(() => {
      const rt = cfg?.redirectTo;

      // string direta
      if (typeof rt === 'string' && rt.endsWith('.html')) {
        window.location.replace(rt);
        return;
      }

      if (rt === 'professor') return redirectToLogin('professor');
      if (rt === 'student') return redirectToLogin('student');
      if (rt === 'auto') return redirectToLogin('auto');

      // padrão (aluno)
      redirectToLogin('student');
    }, 600);

    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}
