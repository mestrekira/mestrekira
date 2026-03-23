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
  const res = await authFetch(url, options);

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
const DONUT_COLORS = {
  c1: '#4f46e5',
  c2: '#16a34a',
  c3: '#f59e0b',
  c4: '#0ea5e9',
  c5: '#ef4444',
  margin: '#ffffff',
  marginStroke: 'rgba(0,0,0,0.12)',
};

function createDonutSVG({ c1, c2, c3, c4, c5, total }, size = 120, thickness = 18) {
  const values = [
    { key: 'c1', label: `C1 (${c1 ?? 0})`, value: Number(c1 || 0), color: DONUT_COLORS.c1 },
    { key: 'c2', label: `C2 (${c2 ?? 0})`, value: Number(c2 || 0), color: DONUT_COLORS.c2 },
    { key: 'c3', label: `C3 (${c3 ?? 0})`, value: Number(c3 || 0), color: DONUT_COLORS.c3 },
    { key: 'c4', label: `C4 (${c4 ?? 0})`, value: Number(c4 || 0), color: DONUT_COLORS.c4 },
    { key: 'c5', label: `C5 (${c5 ?? 0})`, value: Number(c5 || 0), color: DONUT_COLORS.c5 },
  ];

  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : null;
  const margin = safeTotal === null ? 1000 : Math.max(0, 1000 - safeTotal);

  values.push({
    key: 'margin',
    label: `Margem (${margin})`,
    value: margin,
    color: DONUT_COLORS.margin,
  });

  const sum = values.reduce((a, b) => a + b.value, 0) || 1000;

  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let offset = 0;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  values.forEach((seg) => {
    const len = (seg.value / sum) * C;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', seg.color);
    circle.setAttribute('stroke-width', thickness);
    circle.setAttribute('stroke-dasharray', `${len} ${C - len}`);
    circle.setAttribute('stroke-dashoffset', -offset);
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);

    svg.appendChild(circle);
    offset += len;
  });

  return svg;
}

// ---------------- RENDER ----------------
function renderStudents(students = []) {
  studentsListEl.innerHTML = '';

  const count = students.length;
  studentsCountEl.textContent = count;
  studentsCountLabelEl.textContent = `${count} estudante(s)`;

  if (!count) {
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
  const avg = data.performance?.averages || {};

  setText(roomNameEl, room.name);
  setText(roomCodeEl, room.code);
  setText(teacherNameEl, room.teacherNameSnapshot);
  setText(yearNameEl, room.yearName);
  setText(createdAtEl, fmtDateBR(room.createdAt));

  renderStudents(overview.students || []);

  avgDonutEl.innerHTML = '';
  avgDonutEl.appendChild(createDonutSVG(avg));
}

// ---------------- LOAD ----------------
async function load() {
  try {
    setStatus('Carregando...');

    const data = await authFetchJson(
      `${API_URL}/school-dashboard/rooms/${roomId}/overview`
    );

    renderRoom(data);
    setStatus('');
  } catch (err) {
    const msg = String(err?.message || '');

    if (!msg.startsWith('AUTH_')) {
      setStatus('Erro ao carregar');
      notify('error', 'Erro', msg);
    }
  }
}

// ---------------- INIT ----------------
backBtn?.addEventListener('click', () => {
  window.location.href = 'painel-escola.html';
});

(function init() {
  requireSchoolSession();
  load();
})();
