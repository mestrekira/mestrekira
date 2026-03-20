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
    duration: 3200,
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

// -------------------- Toast helpers --------------------
function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
    });
  } else if (type === 'error') {
    alert(`${title}\n\n${message}`);
  } else {
    console.log(title, message);
  }
}

// -------------------- Utils --------------------
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
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.schoolId);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function requireSchoolSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || (role !== 'SCHOOL' && role !== 'ESCOLA')) {
    clearAuth();
    window.location.replace('login-escola.html');
    throw new Error('Sessão de escola ausente/inválida');
  }

  if (user?.id) {
    localStorage.setItem(LS.schoolId, String(user.id));
  }

  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);

  return { token, user };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function authFetch(path, { token, method = 'GET', body } = {}) {
  const headers = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await readJsonSafe(res);

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-escola.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  if (!res.ok) {
    const msg =
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return data;
}

function fmtDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function photoKeyStudent(id) {
  return id ? `mk_photo_student_${id}` : null;
}

function getStudentPhotoDataUrl(studentId) {
  const key = photoKeyStudent(studentId);
  return key ? localStorage.getItem(key) : null;
}

function makeStudentAvatar(studentId, size = 42) {
  const img = document.createElement('img');
  img.className = 'mk-student-photo';
  img.alt = 'Foto do estudante';
  img.width = size;
  img.height = size;

  const dataUrl = getStudentPhotoDataUrl(studentId);

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
const MAX = 1000;
const COLORS = {
  c1: '#4f46e5',
  c2: '#16a34a',
  c3: '#f59e0b',
  c4: '#0ea5e9',
  c5: '#ef4444',
  gap: '#ffffff',
  stroke: '#e5e7eb',
  text: '#0b1220',
};

function createDonutSVG({ c1, c2, c3, c4, c5, total }, size = 120, thickness = 18) {
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : null;
  const margin = safeTotal === null ? 1000 : Math.max(0, MAX - safeTotal);

  const values = [
    { key: 'c1', label: `C1 (${c1 ?? 0})`, value: Number(c1 || 0), color: COLORS.c1 },
    { key: 'c2', label: `C2 (${c2 ?? 0})`, value: Number(c2 || 0), color: COLORS.c2 },
    { key: 'c3', label: `C3 (${c3 ?? 0})`, value: Number(c3 || 0), color: COLORS.c3 },
    { key: 'c4', label: `C4 (${c4 ?? 0})`, value: Number(c4 || 0), color: COLORS.c4 },
    { key: 'c5', label: `C5 (${c5 ?? 0})`, value: Number(c5 || 0), color: COLORS.c5 },
    { key: 'gap', label: `Margem de evolução (${margin})`, value: margin, color: COLORS.gap },
  ];

  const sum = values.reduce((acc, x) => acc + (Number.isFinite(x.value) ? x.value : 0), 0) || 1000;

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
    circle.setAttribute('stroke', seg.color);
    circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(circle);

    offset += segLen;
  });

  const centerText = document.createElementNS(svgNS, 'text');
  centerText.setAttribute('x', String(cx));
  centerText.setAttribute('y', String(cy + 6));
  centerText.setAttribute('text-anchor', 'middle');
  centerText.setAttribute('font-size', '18');
  centerText.setAttribute('font-weight', '700');
  centerText.setAttribute('fill', COLORS.text);
  centerText.textContent = safeTotal === null ? '—' : String(safeTotal);
  svg.appendChild(centerText);

  return { svg, legend: values };
}

function buildLegend(values) {
  const frag = document.createDocumentFragment();

  (Array.isArray(values) ? values : []).forEach((v) => {
    const item = document.createElement('div');
    item.className = 'mk-legend-item';

    const dot = document.createElement('span');
    dot.className = 'mk-dot';
    dot.style.background = v.color;

    if (v.key === 'gap') {
      dot.style.border = '1px solid rgba(15, 23, 42, 0.12)';
    }

    const label = document.createElement('span');
    label.textContent = v.label;

    item.appendChild(dot);
    item.appendChild(label);
    frag.appendChild(item);
  });

  return frag;
}

function renderAverageDonut(averages) {
  if (!avgDonutEl || !avgLegendEl) return;

  avgDonutEl.innerHTML = '';
  avgLegendEl.innerHTML = '';

  const total = averages?.total ?? null;
  const c1 = averages?.c1 ?? 0;
  const c2 = averages?.c2 ?? 0;
  const c3 = averages?.c3 ?? 0;
  const c4 = averages?.c4 ?? 0;
  const c5 = averages?.c5 ?? 0;

  const { svg, legend } = createDonutSVG({ c1, c2, c3, c4, c5, total }, 120, 18);

  avgDonutEl.appendChild(svg);
  avgLegendEl.appendChild(buildLegend(legend));
}

// -------------------- Render --------------------
function renderStudents(students) {
  if (!studentsListEl || !studentsCountLabelEl || !studentsCountEl) return;

  const arr = Array.isArray(students) ? students : [];
  studentsListEl.innerHTML = '';

  studentsCountEl.textContent = String(arr.length);
  studentsCountLabelEl.textContent = `${arr.length} estudante(s)`;

  if (!arr.length) {
    const li = document.createElement('li');
    li.className = 'mk-empty';
    li.textContent = 'Nenhum estudante matriculado nesta sala.';
    studentsListEl.appendChild(li);
    return;
  }

  arr
    .slice()
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    .forEach((student) => {
      const id = String(student?.id || student?.studentId || '').trim();
      const name = String(student?.name || student?.studentName || 'Estudante').trim();
      const email = String(student?.email || student?.studentEmail || '').trim();

      const li = document.createElement('li');
      li.className = 'mk-student-item';

      const avatar = makeStudentAvatar(id, 42);

      const info = document.createElement('div');
      info.className = 'mk-student-info';

      const strong = document.createElement('strong');
      strong.textContent = name || 'Estudante';

      const small = document.createElement('small');
      small.textContent = email || 'Sem e-mail disponível';

      info.appendChild(strong);
      info.appendChild(small);

      li.appendChild(avatar);
      li.appendChild(info);

      studentsListEl.appendChild(li);
    });
}

function renderRoomInfo(payload) {
  const room = payload?.room || {};
  const overview = payload?.overview || {};
  const performance = payload?.performance || {};
  const averages = performance?.averages || {};

  setText(roomNameEl, room?.name);
  setText(roomCodeEl, room?.code);
  setText(teacherNameEl, room?.teacherNameSnapshot);
  setText(yearNameEl, room?.yearName || room?.schoolYearName || room?.schoolYearId || '—');
  setText(createdAtEl, fmtDateBR(room?.createdAt));
  setText(studentsCountEl, overview?.studentsCount ?? 0, '0');

  if (studentsCountLabelEl) {
    studentsCountLabelEl.textContent = `${overview?.studentsCount ?? 0} estudante(s)`;
  }

  renderAverageDonut(averages);
  renderStudents(overview?.students || []);
}

// -------------------- Load --------------------
async function loadOverview(session) {
  try {
    setStatus('Carregando visualização da sala...');

    const data = await authFetch(
      `/school-dashboard/rooms/${encodeURIComponent(roomId)}/overview`,
      { token: session.token }
    );

    renderRoomInfo(data);
    setStatus('');
  } catch (err) {
    console.error(err);

    if (!String(err?.message || '').startsWith('AUTH_')) {
      setStatus('Erro ao carregar a sala.');
      notify(
        'error',
        'Erro',
        String(err?.message || 'Não foi possível carregar a visualização da sala.')
      );
    }
  }
}

// -------------------- Events --------------------
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'painel-escola.html';
  });
}

// -------------------- Init --------------------
(function init() {
  const session = requireSchoolSession();
  loadOverview(session);
})();
