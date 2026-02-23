// auth.js (revisado / robusto)
// Utilitário único de autenticação para front (aluno/professor/escola)

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
    // fallback mínimo (não quebra nada)
    if (type === 'error') console.error(title, message);
    else console.log(`[${type}]`, title, message);
  }
}

// ---------- helpers ----------
function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function isOnLoginPage() {
  const p = String(window.location.pathname || '').toLowerCase();
  // mais específico (evita falso positivo com "login-info" etc)
  return (
    p.includes('login-professor') ||
    p.includes('login-aluno') ||
    p.includes('login-escola') ||
    p.endsWith('/login.html') ||
    p.endsWith('login.html') ||
    p.includes('login-')
  );
}

function hasHeader(headersObj, name) {
  const target = String(name || '').toLowerCase();
  for (const k of Object.keys(headersObj || {})) {
    if (String(k).toLowerCase() === target) return true;
  }
  return false;
}

export function clearAuth({ keepJustLoggedOutFlag = true } = {}) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
  // (opcional futuro) localStorage.removeItem('schoolId');

  // por padrão mantém, para evitar loop de toast/redirect
  if (!keepJustLoggedOutFlag) {
    sessionStorage.removeItem('mk_just_logged_out');
  }
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

export function getRoleUpper() {
  const u = getUser();
  return normRole(u?.role);
}

export function getRoleNormalized() {
  const r = getRoleUpper();
  if (r === 'PROFESSOR' || r === 'TEACHER') return 'professor';
  if (r === 'STUDENT' || r === 'ALUNO') return 'student';
  if (r === 'SCHOOL' || r === 'ESCOLA') return 'school';
  return null;
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

  // ⚠️ allowCompatIdOnly só serve para páginas antigas que NÃO chamam API
  if (!token || !user) return allowCompatIdOnly ? !!getStudentIdCompat() : false;

  const role = normRole(user?.role);
  const ok = role === 'STUDENT' || role === 'ALUNO';

  // garante compat id
  if (ok && user?.id && !getStudentIdCompat()) {
    localStorage.setItem('studentId', String(user.id));
  }
  return ok;
}

export function isProfessorSession({ allowCompatIdOnly = false } = {}) {
  const token = getToken();
  const user = getUser();

  // ⚠️ allowCompatIdOnly só serve para páginas antigas que NÃO chamam API
  if (!token || !user) return allowCompatIdOnly ? !!getProfessorIdCompat() : false;

  const role = normRole(user?.role);
  const ok = role === 'PROFESSOR' || role === 'TEACHER';

  // garante compat id
  if (ok && user?.id && !getProfessorIdCompat()) {
    localStorage.setItem('professorId', String(user.id));
  }
  return ok;
}

export function isSchoolSession() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return false;

  const role = normRole(user?.role);
  return role === 'SCHOOL' || role === 'ESCOLA';
}

// Decide para qual login mandar
function inferLoginPage() {
  // se já estiver numa tela de login, não tenta inferir nada
  if (isOnLoginPage()) return 'login-aluno.html';

  const path = String(window.location.pathname || '').toLowerCase();

  // Se a URL/página contém "escola"/"school", assume ambiente escola
  if (path.includes('escola') || path.includes('school')) return 'login-escola.html';

  // Se a URL/página contém "professor", assume ambiente professor
  if (path.includes('professor')) return 'login-professor.html';

  // Se a sessão atual for escola, manda pro login-escola
  const r = getRoleUpper();
  if (r === 'SCHOOL' || r === 'ESCOLA') return 'login-escola.html';

  // Se a sessão atual for professor, manda pro professor
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

  // ✅ Se professor for gerenciado e precisa trocar senha, bloqueia navegação
  const user = getUser();
  if (user?.mustChangePassword) {
    window.location.replace('professor-atualizar-senha.html');
    throw new Error('MUST_CHANGE_PASSWORD');
  }

  const pid = getProfessorIdCompat();
  if (!pid) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('professorId ausente/inválido');
  }
  return pid;
}

export function requireSchoolSession({ redirectTo = 'login-escola.html' } = {}) {
  if (!isSchoolSession()) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('Sessão de escola ausente/inválida');
  }

  const u = getUser();
  if (!u?.id) {
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('school user.id ausente');
  }

  return String(u.id);
}

// ---------- authFetch ----------
export async function authFetch(url, options = {}, cfg = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  // evita duplicar Content-Type por casing diferente
  if (hasBody && !isFormData && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const justLoggedOut = sessionStorage.getItem('mk_just_logged_out') === '1';

    clearAuth(); // mantém o flag por padrão

    if (!isOnLoginPage()) {
      const redirectTo = cfg.redirectTo || inferLoginPage();

      if (!justLoggedOut) {
        notify(
          'warn',
          'Sessão expirada',
          'Faça login novamente para continuar.',
          3200
        );
      }

      setTimeout(() => window.location.replace(redirectTo), 600);
    }

    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

// ---------- util: leitura de erro (sem "body already used") ----------
export async function readErrorMessage(res, fallback) {
  let msg = fallback || `HTTP ${res.status}`;

  // tenta JSON via clone
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
