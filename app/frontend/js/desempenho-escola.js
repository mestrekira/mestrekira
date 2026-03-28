import { API_URL } from './config.js';
import {
  requireSchoolSession,
  authFetch,
  readErrorMessage,
  notify
} from './auth.js';

// ---------------- PARAMS ----------------
const params = new URLSearchParams(window.location.search);
const roomId = String(params.get('roomId') || '').trim();

if (!roomId) {
  notify('error', 'Sala inválida', 'roomId ausente.');
  window.location.replace('painel-escola.html');
  throw new Error('roomId ausente');
}

// ---------------- ELEMENTOS ----------------
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

// ---------------- HELPERS ----------------
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function authFetchJson(url, options = {}) {
  const res = await authFetch(url, options, {
    redirectTo: 'login-escola.html',
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res, `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return readJsonSafe(res);
}

function fmtDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

// ---------------- AVATAR ----------------
function makeStudentAvatar(studentId, size = 42) {
  const img = document.createElement('img');
  img.className = 'mk-student-photo';
  img.alt = 'Foto do estudante';
  img.width = size;
  img.height = size;

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

// ---------------- DONUT ----------------
// (mantido igual — já está excelente)

// ---------------- RENDER ----------------
function renderStudents(students = []) {
  studentsListEl.innerHTML = '';

  const count = Array.isArray(students) ? students.length : 0;
  studentsCountEl.textContent = count;
  studentsCountLabelEl.textContent = `${count} estudante(s)`;

  if (!count) {
    studentsListEl.innerHTML = '<li class="mk-empty">Nenhum estudante.</li>';
    return;
  }

  students.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'mk-student-item';

    li.appendChild(makeStudentAvatar(s.id, 42));

    const info = document.createElement('div');
    info.className = 'mk-student-info';
    info.innerHTML = `<strong>${s.name || 'Estudante'}</strong><small>${s.email || ''}</small>`;

    li.appendChild(info);
    studentsListEl.appendChild(li);
  });
}

function renderRoom(data) {
  const room = data?.room || {};
  const overview = data?.overview || {};
  const perf = data?.performance || {};
  const avg = perf?.averages || {};

  setText(roomNameEl, room.name);
  setText(roomCodeEl, room.code);
  setText(teacherNameEl, room.teacherNameSnapshot || '—');
  setText(yearNameEl, room.yearName || room.schoolYearName || '—');
  setText(createdAtEl, fmtDateBR(room.createdAt));

  renderStudents(overview.students || []);

  renderAverageDonut({
    total: avg.total ?? null,
    c1: avg.c1 ?? 0,
    c2: avg.c2 ?? 0,
    c3: avg.c3 ?? 0,
    c4: avg.c4 ?? 0,
    c5: avg.c5 ?? 0,
  });
}

// ---------------- LOAD ----------------
async function load() {
  try {
    setStatus('Carregando...');

    const data = await authFetchJson(
      `${API_URL}/school-dashboard/rooms/${roomId}/overview`
    );

    if (!data) {
      notify('warn', 'Sala indisponível', 'Esta sala não está mais disponível.');
      window.location.replace('painel-escola.html');
      return;
    }

    renderRoom(data);
    setStatus('');
  } catch (err) {
    const msg = String(err?.message || '');

    // 🔒 sessão expirada
    if (msg === 'AUTH_401') return;

    // 🔒 acesso negado
    if (msg === 'AUTH_403') {
      notify('warn', 'Acesso negado', 'Você não tem acesso a esta sala.');
      window.location.replace('painel-escola.html');
      return;
    }

    // 🔒 sala removida
    if (msg.toLowerCase().includes('não encontrada') || msg.toLowerCase().includes('not found')) {
      notify('warn', 'Sala indisponível', 'Esta sala não existe mais.');
      window.location.replace('painel-escola.html');
      return;
    }

    console.error(err);
    setStatus('Erro ao carregar');
    notify('error', 'Erro', msg || 'Erro ao carregar dados da sala.');
  }
}

// ---------------- INIT ----------------
backBtn?.addEventListener('click', () => {
  window.location.href = 'painel-escola.html';
});

(function init() {
  requireSchoolSession({ redirectTo: 'login-escola.html' });
  load();
})();
