// auth-fetch.js
import { toast } from './ui-feedback.js';

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

// ✅ detecta se o usuário é aluno/professor pra mandar ao login certo
export function guessLoginPage() {
  // se tiver professorId, manda pro login-professor
  const professorId = localStorage.getItem('professorId');
  if (professorId && professorId !== 'undefined' && professorId !== 'null') {
    return 'login-professor.html';
  }
  return 'login-aluno.html';
}

function notifyAuthExpired() {
  try {
    toast({
      type: 'warn',
      title: 'Sessão expirada',
      message: 'Faça login novamente para continuar.',
      duration: 3200,
    });
  } catch {
    // fallback silencioso
  }
}

/**
 * ✅ authFetch:
 * - injeta Authorization: Bearer <token> quando existir
 * - injeta Content-Type automaticamente quando houver body e não for FormData
 * - trata 401/403: limpa auth e redireciona
 */
export async function authFetch(url, options = {}) {
  const token = getToken();

  const headers = new Headers(options.headers || {});

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    notifyAuthExpired();
    clearAuth();
    setTimeout(() => window.location.replace(guessLoginPage()), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

// ----------------- helpers opcionais -----------------

async function parseErrorMessage(res) {
  // tenta JSON -> message/error; senão texto
  try {
    const data = await res.clone().json();
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.join(' | ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  } catch {}

  try {
    const t = await res.clone().text();
    if (t && t.trim()) return t.slice(0, 300);
  } catch {}

  return `HTTP ${res.status}`;
}

export async function apiGet(url) {
  const res = await authFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json().catch(() => null);
}

export async function apiPost(url, bodyObj) {
  const res = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(bodyObj ?? {}),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json().catch(() => null);
}

export async function apiDelete(url, bodyObj) {
  const opts = { method: 'DELETE' };
  if (bodyObj !== undefined) {
    opts.body = JSON.stringify(bodyObj);
  }
  const res = await authFetch(url, opts);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json().catch(() => null);
}
