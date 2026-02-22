// entrar-sala.js (refatorado)
// - NÃO faz login/cadastro aqui (apenas entra na sala)
// - exige sessão válida de aluno (token + user)
// - usa authFetch com tratamento 401/403
// - compat: também envia studentId (se backend ainda exigir)

import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// -------------------- UI --------------------
const status = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');
const codeEl = document.getElementById('code');

function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration: duration ?? (type === 'error' ? 4200 : type === 'warn' ? 3200 : 2400),
    });
  } catch {
    if (type === 'error') alert(`${title}\n\n${message}`);
  }
}

function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function setBusy(busy) {
  if (enterBtn) enterBtn.disabled = !!busy;
  if (codeEl) codeEl.disabled = !!busy;
}

// -------------------- Auth helpers --------------------
function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('professorId');
  localStorage.removeItem('studentId');
}

function getToken() {
  return localStorage.getItem('token') || '';
}

function getUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStudentIdCompat() {
  const id = localStorage.getItem('studentId');
  if (!id || id === 'undefined' || id === 'null') return '';
  return String(id);
}

function isStudentSession() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return false;

  const role = normRole(user?.role);
  const ok = role === 'STUDENT' || role === 'ALUNO';

  // injeta compat id
  if (ok && user?.id && !getStudentIdCompat()) {
    localStorage.setItem('studentId', String(user.id));
  }

  return ok;
}

async function readErrorMessage(res) {
  // tenta JSON
  try {
    const data = await res.json();
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.join(' | ');
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {
    // ignora
  }
  // tenta texto
  try {
    const t = await res.text();
    if (t && t.trim()) return t.trim().slice(0, 300);
  } catch {
    // ignora
  }
  return `HTTP ${res.status}`;
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

// -------------------- Guard --------------------
if (!isStudentSession()) {
  clearAuth();
  window.location.replace('login-aluno.html');
  throw new Error('Sessão de aluno ausente/inválida');
}

// -------------------- Action --------------------
async function entrarSala() {
  const code = (codeEl?.value || '').trim().toUpperCase();
  if (!code) {
    setStatus('Informe o código da sala.');
    notify('warn', 'Código obrigatório', 'Digite o código da sala para entrar.');
    return;
  }

  setBusy(true);
  setStatus('Entrando na sala...');

  try {
    const studentId = getStudentIdCompat(); // compat
    const res = await authFetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      body: JSON.stringify({ code, studentId }),
    });

    if (!res.ok) {
      const msg = await readErrorMessage(res);
      throw new Error(msg);
    }

    const data = await res.json().catch(() => null);
    const roomId = data?.roomId || data?.id || data?.room?.id;

    if (!roomId) {
      throw new Error('Resposta inválida do servidor (roomId ausente).');
    }

    notify('success', 'Tudo certo', 'Você entrou na sala!');
    window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(String(roomId))}`;
  } catch (e) {
    const msg = String(e?.message || 'Erro ao entrar na sala.');
    if (!msg.startsWith('AUTH_')) {
      setStatus('Erro ao entrar na sala. Verifique o código.');
      notify('error', 'Não foi possível entrar', msg);
      setBusy(false);
    }
  }
}

// Eventos
if (enterBtn) enterBtn.addEventListener('click', entrarSala);
if (codeEl) {
  codeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarSala();
  });
}
