// painel-aluno.js

import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// -------------------- UI helpers --------------------
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

    if (role !== 'STUDENT' && role !== 'ALUNO') return false;

    if (user?.id && !getStudentIdCompat()) {
      localStorage.setItem('studentId', String(user.id));
    }

    return true;
  } catch {
    return false;
  }
}

async function readErrorMessage(res) {
  // ⚠️ Só chamar isso quando você NÃO for ler o body depois (você já faz certo)
  try {
    const data = await res.json();
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.join(' | ');
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {}

  try {
    const t = await res.text();
    if (t && String(t).trim()) return String(t).trim().slice(0, 300);
  } catch {}

  return `HTTP ${res.status}`;
}

let redirected = false;

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token') || '';
  const headers = { ...(options.headers || {}) };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if ((res.status === 401 || res.status === 403) && !redirected) {
    redirected = true;
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-aluno.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  return res;
}

// -------------------- Guard inicial --------------------
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

// -------------------- Página --------------------
const roomsList = document.getElementById('roomsList');

function renderEmpty(msg) {
  if (!roomsList) return;
  roomsList.innerHTML = `<li>${msg}</li>`;
}

function normalizeRoom(r) {
  const id = String(r?.id || r?.roomId || '').trim();
  const name = String(r?.name || r?.roomName || 'Sala').trim();
  return { id, name };
}

async function carregarMinhasSalas() {
  if (!roomsList) return;

  renderEmpty('Carregando...');

  try {
    const res = await authFetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res);
      throw new Error(msg);
    }

    const raw = await res.json().catch(() => null);
    const arr = Array.isArray(raw) ? raw : [];
    const rooms = arr.map(normalizeRoom).filter((r) => !!r.id);

    roomsList.innerHTML = '';

    if (rooms.length === 0) {
      renderEmpty('Você ainda não está em nenhuma sala.');
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');

      const nameText = document.createElement('span');
      nameText.textContent = room.name + ' ';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Abrir';
      btn.addEventListener('click', () => {
        window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(room.id)}`;
      });

      li.appendChild(nameText);
      li.appendChild(btn);
      roomsList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    renderEmpty('Erro ao carregar suas salas.');
    notify('error', 'Erro', 'Não foi possível carregar suas salas agora. Tente novamente.');
  }
}

carregarMinhasSalas();
