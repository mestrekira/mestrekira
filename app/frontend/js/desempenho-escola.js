import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',
  professorId: 'professorId',
  studentId: 'studentId',
};

const params = new URLSearchParams(window.location.search);
const roomId = String(params.get('roomId') || '').trim();

if (!roomId) {
  toast?.({
    type: 'error',
    title: 'Sala inválida',
    message: 'roomId ausente.',
  });
  window.location.replace('painel-escola.html');
  throw new Error('roomId ausente');
}

// -------------------- Elements --------------------
const backBtn = document.getElementById('backBtn');
const statusEl = document.getElementById('status');

const roomNameEl = document.getElementById('roomName');
const roomCodeEl = document.getElementById('roomCode');
const teacherNameEl = document.getElementById('teacherName');
const yearNameEl = document.getElementById('yearName');
const createdAtEl = document.getElementById('createdAt');
const studentsCountEl = document.getElementById('studentsCount');
const studentsCountLabelEl = document.getElementById('studentsCountLabel');

const avgDonutEl = document.getElementById('avgDonut');
const avgLegendEl = document.getElementById('avgLegend');

const studentsListEl = document.getElementById('studentsList');

// -------------------- Helpers --------------------
function notify(type, title, message) {
  if (typeof toast === 'function') {
    toast({ type, title, message });
  }
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

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
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}

function requireSchoolSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || (role !== 'SCHOOL' && role !== 'ESCOLA')) {
    clearAuth();
    window.location.replace('login-escola.html');
    throw new Error('Sessão inválida');
  }

  return { token, user };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function authFetch(path, { token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await readJsonSafe(res);

  if (res.status === 401 || res.status === 403) {
    clearAuth();
    window.location.replace('login-escola.html');
    throw new Error(`AUTH_${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Erro na requisição');
  }

  return data;
}

function fmtDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

// -------------------- Avatar --------------------
function makeStudentAvatar(studentId, size = 42) {
  const img = document.createElement('img');
  img.className = 'mk-student-photo';

  const dataUrl = localStorage.getItem(`mk_photo_student_${studentId}`);

  img.src =
    dataUrl ||
    'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eef2f7"/>
          <text x="50%" y="55%" font-size="16" text-anchor="middle" fill="#64748b">?</text>
        </svg>`
      );

  return img;
}

// -------------------- Donut --------------------
function createDonut({ c1, c2, c3, c4, c5, total }) {
  const values = [
    { label: `C1 (${c1 || 0})`, value: c1 || 0, color: '#4f46e5' },
    { label: `C2 (${c2 || 0})`, value: c2 || 0, color: '#16a34a' },
    { label: `C3 (${c3 || 0})`, value: c3 || 0, color: '#f59e0b' },
    { label: `C4 (${c4 || 0})`, value: c4 || 0, color: '#0ea5e9' },
    { label: `C5 (${c5 || 0})`, value: c5 || 0, color: '#ef4444' },
  ];

  avgDonutEl.innerHTML = `<strong>${total ?? '—'}</strong>`;
  avgLegendEl.innerHTML = '';

  values.forEach((v) => {
    const div = document.createElement('div');
    div.className = 'mk-legend-item';
    div.innerHTML = `<span class="mk-dot" style="background:${v.color}"></span>${v.label}`;
    avgLegendEl.appendChild(div);
  });
}

// -------------------- Render --------------------
function renderStudents(students = []) {
  studentsListEl.innerHTML = '';
  studentsCountEl.textContent = students.length;
  studentsCountLabelEl.textContent = `${students.length} estudante(s)`;

  if (!students.length) {
    studentsListEl.innerHTML = '<li class="mk-empty">Nenhum estudante.</li>';
    return;
  }

  students.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'mk-student-item';

    li.appendChild(makeStudentAvatar(s.id));

    const info = document.createElement('div');
    info.className = 'mk-student-info';
    info.innerHTML = `<strong>${s.name || 'Estudante'}</strong><small>${s.email || ''}</small>`;

    li.appendChild(info);
    studentsListEl.appendChild(li);
  });
}

function renderRoom(data) {
  const room = data.room || {};
  const overview = data.overview || {};
  const perf = data.performance || {};

  setText(roomNameEl, room.name);
  setText(roomCodeEl, room.code);
  setText(teacherNameEl, room.teacherNameSnapshot);
  setText(yearNameEl, room.schoolYearId);
  setText(createdAtEl, fmtDateBR(room.createdAt));

  renderStudents(overview.students);

  createDonut({
    ...perf.averages,
  });
}

// -------------------- Load --------------------
async function load(session) {
  try {
    setStatus('Carregando...');

    const data = await authFetch(
      `/school-dashboard/rooms/${roomId}/overview`,
      { token: session.token }
    );

    renderRoom(data);

    setStatus('');
  } catch (e) {
    if (!String(e.message).startsWith('AUTH_')) {
      setStatus('Erro ao carregar');
      notify('error', 'Erro', e.message);
    }
  }
}

// -------------------- Events --------------------
backBtn?.addEventListener('click', () => {
  window.location.href = 'painel-escola.html';
});

// -------------------- Init --------------------
(function init() {
  const session = requireSchoolSession();
  load(session);
})();
