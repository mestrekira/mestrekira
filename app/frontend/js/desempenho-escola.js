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

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
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

// ---------------- DONUT + LEGENDA (MÉDIA GERAL DA TURMA) ----------------
const DONUT_COLORS = {
  c1: '#4f46e5',
  c2: '#16a34a',
  c3: '#f59e0b',
  c4: '#0ea5e9',
  c5: '#ef4444',
  margin: '#ffffff',
  marginStroke: 'rgba(0,0,0,0.12)',
  score: '#4f46e5',
  studentMargin: '#e5e7eb',
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
    label: `Margem de evolução (${margin})`,
    value: margin,
    color: DONUT_COLORS.margin,
    isMargin: true,
  });

  const sum =
    values.reduce((acc, x) => acc + (Number.isFinite(x.value) ? x.value : 0), 0) || 1000;

  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let offset = 0;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  const base = document.createElementNS(svgNS, 'circle');
  base.setAttribute('cx', String(cx));
  base.setAttribute('cy', String(cy));
  base.setAttribute('r', String(r));
  base.setAttribute('fill', 'none');
  base.setAttribute('stroke', 'rgba(0,0,0,0.08)');
  base.setAttribute('stroke-width', String(thickness));
  svg.appendChild(base);

  values.forEach((seg) => {
    const frac = seg.value / sum;
    const segLen = Math.max(0, frac * C);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', String(thickness));
    circle.setAttribute('stroke-linecap', 'butt');
    circle.setAttribute('stroke', seg.isMargin ? DONUT_COLORS.margin : seg.color);
    circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(circle);

    if (seg.isMargin) {
      const border = document.createElementNS(svgNS, 'circle');
      border.setAttribute('cx', String(cx));
      border.setAttribute('cy', String(cy));
      border.setAttribute('r', String(r));
      border.setAttribute('fill', 'none');
      border.setAttribute('stroke', DONUT_COLORS.marginStroke);
      border.setAttribute('stroke-width', '1');
      svg.appendChild(border);
    }

    offset += segLen;
  });

  const centerText = document.createElementNS(svgNS, 'text');
  centerText.setAttribute('x', String(cx));
  centerText.setAttribute('y', String(cy + 6));
  centerText.setAttribute('text-anchor', 'middle');
  centerText.setAttribute('font-size', '18');
  centerText.setAttribute('font-weight', '700');
  centerText.setAttribute('fill', '#111827');
  centerText.textContent = safeTotal === null ? '—' : String(safeTotal);
  svg.appendChild(centerText);

  return { svg, legend: values };
}

function buildLegendGrid(values) {
  const legend = document.createElement('div');
  legend.className = 'mk-legend';

  (Array.isArray(values) ? values : []).forEach((v) => {
    const item = document.createElement('div');
    item.className = 'mk-legend-item';

    const dot = document.createElement('span');
    dot.className = 'mk-dot';
    dot.style.background = v.color;

    if (v.key === 'margin') {
      dot.style.border = `1px solid ${DONUT_COLORS.marginStroke}`;
    }

    const label = document.createElement('span');
    label.textContent = v.label;

    item.appendChild(dot);
    item.appendChild(label);
    legend.appendChild(item);
  });

  return legend;
}

function renderAverageDonut({ total = null, c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0 }) {
  if (!avgDonutEl || !avgLegendEl) return;

  avgDonutEl.innerHTML = '';
  avgLegendEl.innerHTML = '';

  const { svg, legend } = createDonutSVG(
    { c1, c2, c3, c4, c5, total },
    120,
    18,
  );

  avgDonutEl.appendChild(svg);
  avgLegendEl.appendChild(buildLegendGrid(legend));
}

// ---------------- DONUT INDIVIDUAL DO ESTUDANTE ----------------
function createStudentScoreDonutSVG(score, size = 64, thickness = 10) {
  const safeScoreRaw = toNumberOrNull(score);
  const safeScore =
    safeScoreRaw === null ? null : Math.max(0, Math.min(1000, safeScoreRaw));

  const obtained = safeScore === null ? 0 : safeScore;
  const margin = safeScore === null ? 1000 : Math.max(0, 1000 - safeScore);

  const segments = [
    { value: obtained, color: DONUT_COLORS.score },
    { value: margin, color: DONUT_COLORS.studentMargin },
  ];

  const sum = 1000;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let offset = 0;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  const base = document.createElementNS(svgNS, 'circle');
  base.setAttribute('cx', String(cx));
  base.setAttribute('cy', String(cy));
  base.setAttribute('r', String(r));
  base.setAttribute('fill', 'none');
  base.setAttribute('stroke', 'rgba(0,0,0,0.08)');
  base.setAttribute('stroke-width', String(thickness));
  svg.appendChild(base);

  segments.forEach((seg) => {
    const segLen = Math.max(0, (seg.value / sum) * C);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', String(thickness));
    circle.setAttribute('stroke-linecap', 'butt');
    circle.setAttribute('stroke', seg.color);
    circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(circle);

    offset += segLen;
  });

  const centerText = document.createElementNS(svgNS, 'text');
  centerText.setAttribute('x', String(cx));
  centerText.setAttribute('y', String(cy + 4));
  centerText.setAttribute('text-anchor', 'middle');
  centerText.setAttribute('font-size', size <= 64 ? '11' : '14');
  centerText.setAttribute('font-weight', '700');
  centerText.setAttribute('fill', '#111827');
  centerText.textContent = safeScore === null ? '—' : String(safeScore);
  svg.appendChild(centerText);

  return svg;
}

// ---------------- RENDER ----------------
function renderStudents(students = []) {
  if (!studentsListEl) return;

  studentsListEl.innerHTML = '';

  const normalized = (Array.isArray(students) ? students : []).map((s) => ({
    ...s,
    averageScore: toNumberOrNull(s?.averageScore),
  }));

  normalized.sort((a, b) => {
    const av = a.averageScore;
    const bv = b.averageScore;

    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });

  const count = normalized.length;

  if (studentsCountEl) studentsCountEl.textContent = count;
  if (studentsCountLabelEl) studentsCountLabelEl.textContent = `${count} estudante(s)`;

  if (!count) {
    studentsListEl.innerHTML = '<li class="mk-empty">Nenhum estudante.</li>';
    return;
  }

  normalized.forEach((s, index) => {
    const li = document.createElement('li');
    li.className = 'mk-student-item';

    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.gap = '12px';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '12px';
    left.style.minWidth = '0';
    left.style.flex = '1';

    left.appendChild(makeStudentAvatar(s.id, 42));

    const info = document.createElement('div');
    info.className = 'mk-student-info';

    const position = index + 1;
    const avgLabel =
      s.averageScore === null ? 'Sem média' : `Média geral: ${s.averageScore}`;

    info.innerHTML =
      `<strong>#${position} ${s.name || 'Estudante'}</strong>` +
      `<small>${s.email || ''}</small>` +
      `<small>${avgLabel}</small>`;

    left.appendChild(info);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    right.style.flexShrink = '0';

    const scoreWrap = document.createElement('div');
    scoreWrap.style.display = 'flex';
    scoreWrap.style.flexDirection = 'column';
    scoreWrap.style.alignItems = 'center';
    scoreWrap.style.justifyContent = 'center';
    scoreWrap.style.minWidth = '72px';

    const donut = createStudentScoreDonutSVG(s.averageScore, 64, 10);

    const scoreText = document.createElement('small');
    scoreText.textContent = s.averageScore === null ? 'Sem nota' : `${s.averageScore} pts`;
    scoreText.style.marginTop = '4px';
    scoreText.style.color = '#475569';
    scoreText.style.fontWeight = '600';

    scoreWrap.appendChild(donut);
    scoreWrap.appendChild(scoreText);

    right.appendChild(scoreWrap);

    li.appendChild(left);
    li.appendChild(right);

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
  setText(yearNameEl, room.yearName || room.schoolYearName || room.schoolYearId || '—');
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

    if (msg === 'AUTH_401') return;

    if (msg === 'AUTH_403') {
      notify('warn', 'Acesso negado', 'Você não tem acesso a esta sala.');
      window.location.replace('painel-escola.html');
      return;
    }

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
