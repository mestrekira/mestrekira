// auth.js
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
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
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

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

/**
 * Compat: ainda usa studentId em páginas legadas.
 * (No futuro, o ideal é o backend derivar o id do token, sem querystring.)
 */
export function getStudentIdCompat() {
  const id = localStorage.getItem('studentId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

/**
 * Garante sessão de aluno:
 * - Se houver token + user.role: valida role
 * - Se houver token + user.id: injeta studentId compat (se faltar)
 * - Se NÃO houver token/user: fallback aceitando apenas studentId (legado)
 */
export function requireStudentSession(options = {}) {
  const redirectTo = options.redirectTo || 'login-aluno.html';
  const allowLegacyWithoutToken = options.allowLegacyWithoutToken ?? true;

  const token = getToken();
  const userJson = localStorage.getItem('user');

  // legado: só studentId
  if ((!token || !userJson) && allowLegacyWithoutToken) {
    const sid = getStudentIdCompat();
    if (sid) return { ok: true, studentId: sid, legacy: true };
  }

  if (!token || !userJson) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('AUTH_MISSING');
  }

  try {
    const user = JSON.parse(userJson);
    const role = normRole(user?.role);

    if (role !== 'STUDENT' && role !== 'ALUNO') {
      notify('error', 'Acesso negado', 'Você não tem permissão para acessar esta página.', 3200);
      window.location.replace(redirectTo);
      throw new Error('AUTH_ROLE');
    }

    // injeta studentId compat se faltar
    if (user?.id && !getStudentIdCompat()) {
      localStorage.setItem('studentId', String(user.id));
    }

    const sid = getStudentIdCompat() || (user?.id ? String(user.id) : '');
    if (!sid) {
      notify('warn', 'Sessão inválida', 'Faça login novamente.', 3200);
      clearAuth();
      window.location.replace(redirectTo);
      throw new Error('AUTH_NO_STUDENTID');
    }

    return { ok: true, studentId: sid, legacy: false };
  } catch (e) {
    notify('warn', 'Sessão inválida', 'Faça login novamente.', 3200);
    clearAuth();
    window.location.replace(redirectTo);
    throw new Error('AUTH_BAD_USER');
  }
}

/**
 * authFetch:
 * - Injeta Authorization: Bearer <token> (se existir)
 * - Injeta Content-Type: application/json quando há body e não foi setado
 * - Trata 401/403: limpa sessão + redireciona
 */
export async function authFetch(url, options = {}, authOptions = {}) {
  const redirectTo = authOptions.redirectTo || 'login-aluno.html';

  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace(redirectTo), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}
