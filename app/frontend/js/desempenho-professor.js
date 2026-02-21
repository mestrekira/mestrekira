import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  toast?.({ title: 'Sala inválida', message: 'roomId ausente.', type: 'error' });
  window.location.replace('professor-salas.html');
  throw new Error('roomId ausente');
}

// ---------------- Elementos ----------------

const roomNameEl = document.getElementById('roomName');
const statusEl = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

const roomAvgDonutEl = document.getElementById('roomAvgDonut');
const roomAvgLegendEl = document.getElementById('roomAvgLegend');

const tasksListEl = document.getElementById('tasksList');
const taskPanelEl = document.getElementById('taskPanel');
const taskPanelTitleEl = document.getElementById('taskPanelTitle');
const taskPanelMetaEl = document.getElementById('taskPanelMeta');
const closeTaskPanelBtn = document.getElementById('closeTaskPanelBtn');

const studentsList = document.getElementById('studentsList');

// ---------------- Toast helpers ----------------

function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } else {
    if (type === 'error') alert(`${title}\n\n${message}`);
    else console.log(title, message);
  }
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

// ---------------- Sessão (professor) + authFetch ----------------

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
};

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
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function requireProfessorSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || role !== 'PROFESSOR') {
    clearAuth();
    window.location.replace('login-professor.html');
    throw new Error('Sessão de professor ausente/inválida');
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

function unwrapResult(data) {
  // suporta: array puro, objeto puro, {ok,result}, {data}
  if (Array.isArray(data)) return data;

  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (data.result && typeof data.result === 'object') return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return data.data;
  }

  return data;
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

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-professor.html'), 600);
    throw new Error(`AUTH_${res.status}`);
  }

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ---------------- utils (médias/datas) ----------------

function mean(nums) {
  const v = (Array.isArray(nums) ? nums : [])
    .map((n) => (n === null || n === undefined ? null : Number(n)))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value; // epoch s ou ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  // tenta parse direto
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  // tenta número em string
  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d2 = new Date(ms);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

function getEssaySentAt(e) {
  return pickDate(e, [
    'submittedAt',
    'submitted_at',
    'createdAt',
    'created_at',
    'updatedAt',
    'updated_at',
  ]);
}

// ---------------- Fotos (localStorage) ----------------

function studentPhotoKey(studentId) {
  return studentId ? `mk_photo_student_${studentId}` : null;
}

function getStudentPhotoDataUrl(studentId) {
  const key = studentPhotoKey(studentId);
  return key ? localStorage.getItem(key) : null;
}

function makeAvatar(studentId, size = 38) {
  const img = document.createElement('img');
  img.alt = 'Foto do aluno';
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.border = '1px solid #ccc';
  img.style.display = 'inline-block';

  const dataUrl = getStudentPhotoDataUrl(studentId);
  if (dataUrl) {
    img.src = dataUrl;
    return img;
  }

  img.src =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">?</text>
      </svg>`,
    );

  return img;
}

// ---------------- donut (estilo sua imagem) ----------------

// cores fixas para manter padrão
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
    label: `Margem de evolução (${margin})`,
    value: margin,
    color: DONUT_COLORS.margin,
    isMargin: true,
  });

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

function renderRoomAverageDonut({ mC1, mC2, mC3, mC4, mC5, mTotal }) {
  if (!roomAvgDonutEl || !roomAvgLegendEl) return;

  roomAvgDonutEl.innerHTML = '';
  roomAvgLegendEl.innerHTML = '';

  const { svg, legend } = createDonutSVG(
    { c1: mC1 ?? 0, c2: mC2 ?? 0, c3: mC3 ?? 0, c4: mC4 ?? 0, c5: mC5 ?? 0, total: mTotal },
    120,
    18,
  );

  svg.classList.add('mk-donut');
  roomAvgDonutEl.appendChild(svg);
  roomAvgLegendEl.appendChild(buildLegendGrid(legend));
}

// ---------------- alunos ativos ----------------

async function getActiveStudentsSetAuth(session) {
  try {
    const data = await authFetch(`/rooms/${encodeURIComponent(roomId)}/students`, {
      token: session.token,
    });
    const list = unwrapResult(data);
    const arr = Array.isArray(list) ? list : [];

    const ids = arr
      .map((s) => String(s?.id || s?.studentId || '').trim())
      .filter(Boolean);

    return new Set(ids);
  } catch {
    return null;
  }
}

// ---------------- UI: inline panel (desempenho individual) ----------------

function closeAllInlinePanels() {
  if (!studentsList) return;
  const panels = studentsList.querySelectorAll('.mk-inline-panel');
  panels.forEach((p) => (p.style.display = 'none'));
}

function buildInlinePanel() {
  const wrap = document.createElement('div');
  wrap.className = 'mk-inline-panel';
  wrap.style.display = 'none';

  const head = document.createElement('div');
  head.className = 'mk-inline-head';

  const title = document.createElement('strong');
  title.textContent = 'Desempenho individual';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Fechar';
  closeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    wrap.style.display = 'none';
  });

  head.appendChild(title);
  head.appendChild(closeBtn);

  const info = document.createElement('div');
  info.className = 'mk-inline-info';

  const h4 = document.createElement('h4');
  h4.textContent = 'Redações do aluno';
  h4.style.marginTop = '10px';

  const essaysUl = document.createElement('ul');
  essaysUl.className = 'lista mk-inline-essays';

  wrap.appendChild(head);
  wrap.appendChild(info);
  wrap.appendChild(h4);
  wrap.appendChild(essaysUl);

  return wrap;
}

function fillInlinePanel(panel, studentGroup, medias) {
  if (!panel) return;

  const info = panel.querySelector('.mk-inline-info');
  const essaysUl = panel.querySelector('.mk-inline-essays');

  if (info) {
    info.innerHTML = `
      <ul class="lista">
        <li>Média total: <strong>${medias.mTotal ?? '—'}</strong></li>
        <li>C1 — Domínio da norma culta: <strong>${medias.mC1 ?? '—'}</strong></li>
        <li>C2 — Compreensão do tema e repertório: <strong>${medias.mC2 ?? '—'}</strong></li>
        <li>C3 — Argumentação e projeto de texto: <strong>${medias.mC3 ?? '—'}</strong></li>
        <li>C4 — Coesão e mecanismos linguísticos: <strong>${medias.mC4 ?? '—'}</strong></li>
        <li>C5 — Proposta de intervenção: <strong>${medias.mC5 ?? '—'}</strong></li>
      </ul>
    `;
  }

  if (!essaysUl) return;
  essaysUl.innerHTML = '';

  const essays = [...(studentGroup.essays || [])];

  // ordena por título da tarefa e, em empate, por data de envio
  essays.sort((a, b) => {
    const at = String(a.taskTitle || a.task?.title || '').localeCompare(
      String(b.taskTitle || b.task?.title || ''),
    );
    if (at !== 0) return at;

    const da = toDateSafe(getEssaySentAt(a))?.getTime?.() ?? -Infinity;
    const db = toDateSafe(getEssaySentAt(b))?.getTime?.() ?? -Infinity;
    return db - da;
  });

  essays.forEach((e) => {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = e.taskTitle || e.task?.title || 'Tarefa';

    const nota = document.createElement('div');
    nota.textContent =
      e.score !== null && e.score !== undefined
        ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${
            e.c4 ?? '—'
          } C5 ${e.c5 ?? '—'})`
        : 'Sem correção';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ver redação/feedback';
    btn.onclick = () => {
      const tId = e.taskId || e.task?.id || null;
      if (!tId) {
        notify('error', 'Erro', 'Não encontrei o taskId desta redação no retorno do servidor.');
        return;
      }
      window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(
        String(tId),
      )}&studentId=${encodeURIComponent(String(studentGroup.studentId))}`;
    };

    li.appendChild(title);
    li.appendChild(document.createElement('br'));
    li.appendChild(nota);
    li.appendChild(document.createElement('br'));
    li.appendChild(btn);

    essaysUl.appendChild(li);
  });
}

// ---------------- carregar sala ----------------

async function carregarSala(session) {
  if (!roomNameEl) return;
  try {
    const data = await authFetch(`/rooms/${encodeURIComponent(roomId)}`, {
      token: session.token,
    });
    const room = unwrapResult(data);
    roomNameEl.textContent = room?.name || 'Sala';
  } catch {
    roomNameEl.textContent = 'Sala';
  }
}

// ---------------- dados e render ----------------

let cachedData = [];
let cachedActiveSet = null;

// cache de tasks da sala p/ “mais recente”
let cachedTasksMeta = [];
let cachedNewestTaskId = null;

async function fetchTasksByRoomAuth(session) {
  try {
    const data = await authFetch(`/tasks/by-room?roomId=${encodeURIComponent(roomId)}`, {
      token: session.token,
    });
    const raw = unwrapResult(data);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function normalizeTasksMeta(rawArr) {
  const arr = Array.isArray(rawArr) ? rawArr : [];
  return arr
    .map((t) => {
      const id = String(t?.id || t?.taskId || '').trim();
      const title = String(t?.title || t?.taskTitle || t?.name || '').trim();
      const createdAt = pickDate(t, ['createdAt', 'created_at', 'created', 'dateCreated', 'timestamp']);
      const createdTime = toDateSafe(createdAt)?.getTime?.() ?? null;
      return { id, title, createdTime, _raw: t };
    })
    .filter((t) => !!t.id);
}

function computeNewestTaskIdFromTasksMeta(tasksMeta) {
  if (!Array.isArray(tasksMeta) || tasksMeta.length === 0) return null;

  let newestId = null;
  let newestTime = -Infinity;

  tasksMeta.forEach((t) => {
    if (typeof t.createdTime === 'number' && !Number.isNaN(t.createdTime)) {
      if (t.createdTime > newestTime) {
        newestTime = t.createdTime;
        newestId = t.id;
      }
    }
  });

  return newestId || tasksMeta[tasksMeta.length - 1].id;
}

// fallback: se tasks não tiverem createdAt, usa maior “enviado em” nas redações
function computeNewestTaskIdFromEssays(data) {
  const mapMax = new Map(); // taskId -> maxTime

  (Array.isArray(data) ? data : []).forEach((e) => {
    const tId = String(e.taskId || e.task?.id || '').trim();
    if (!tId) return;

    const d = toDateSafe(getEssaySentAt(e));
    const time = d ? d.getTime() : null;
    if (time === null) return;

    const prev = mapMax.get(tId);
    if (prev === undefined || time > prev) mapMax.set(tId, time);
  });

  let bestId = null;
  let bestTime = -Infinity;

  for (const [tId, time] of mapMax.entries()) {
    if (time > bestTime) {
      bestTime = time;
      bestId = tId;
    }
  }

  return bestId;
}

function buildTasksFromData(data) {
  const map = new Map();

  (Array.isArray(data) ? data : []).forEach((e) => {
    const tId = e.taskId || e.task?.id || null;
    const title = e.taskTitle || e.task?.title || 'Tarefa';
    if (!tId) return;

    const key = String(tId);

    if (!map.has(key)) {
      map.set(key, {
        taskId: key,
        title,
        count: 0,
        correctedCount: 0,
      });
    }

    const g = map.get(key);
    g.count += 1;
    if (e.score !== null && e.score !== undefined) g.correctedCount += 1;
  });

  const tasks = Array.from(map.values());
  tasks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return tasks;
}

function makeNewestBadge() {
  const badge = document.createElement('span');
  badge.textContent = 'Mais recente';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '3px 8px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '900';
  badge.style.marginLeft = '10px';
  badge.style.background = 'rgba(109,40,217,.12)';
  badge.style.border = '1px solid rgba(109,40,217,.35)';
  badge.style.color = '#0b1f4b';
  return badge;
}

function renderTasksList(tasks) {
  if (!tasksListEl) return;
  tasksListEl.innerHTML = '';

  if (!Array.isArray(tasks) || tasks.length === 0) {
    tasksListEl.innerHTML = `<div class="mk-muted">Nenhuma tarefa com redações ainda.</div>`;
    return;
  }

  const newestId = cachedNewestTaskId;

  // ordena colocando a mais recente no topo
  const ordered = [...tasks].sort((a, b) => {
    if (newestId) {
      const aIs = String(a.taskId) === String(newestId) ? 1 : 0;
      const bIs = String(b.taskId) === String(newestId) ? 1 : 0;
      if (aIs !== bIs) return bIs - aIs;
    }
    return (a.title || '').localeCompare(b.title || '');
  });

  ordered.forEach((t) => {
    const isNewest = newestId && String(t.taskId) === String(newestId);

    const btn = document.createElement('button');
    btn.className = 'mk-task-btn';
    btn.type = 'button';

    if (isNewest) {
      btn.style.border = '2px solid rgba(109,40,217,.35)';
      btn.style.boxShadow = '0 10px 24px rgba(109,40,217,0.12)';
    }

    const titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';
    titleWrap.style.flexWrap = 'wrap';
    titleWrap.style.gap = '6px';

    const strong = document.createElement('strong');
    strong.textContent = t.title;

    titleWrap.appendChild(strong);
    if (isNewest) titleWrap.appendChild(makeNewestBadge());

    const small = document.createElement('small');
    small.textContent = `${t.count} envio(s) • ${t.correctedCount} corrigida(s)`;

    btn.innerHTML = '';
    btn.appendChild(titleWrap);
    btn.appendChild(small);

    btn.addEventListener('click', () => openTaskPanel(t.taskId, t.title));
    tasksListEl.appendChild(btn);
  });
}

function groupByStudent(data) {
  const byStudent = new Map();

  (Array.isArray(data) ? data : []).forEach((e) => {
    const sid = e.studentId;
    if (!sid) return;

    const key = String(sid);

    if (!byStudent.has(key)) {
      byStudent.set(key, {
        studentId: key,
        studentName: e.studentName || '',
        studentEmail: e.studentEmail || '',
        essays: [],
      });
    }

    const g = byStudent.get(key);
    if (!g.studentName && e.studentName) g.studentName = e.studentName;
    if (!g.studentEmail && e.studentEmail) g.studentEmail = e.studentEmail;

    g.essays.push(e);
  });

  const students = Array.from(byStudent.values());
  students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
  return students;
}

function computeStudentAverages(studentGroup) {
  const correctedEssays = (studentGroup.essays || []).filter(
    (e) => e.score !== null && e.score !== undefined,
  );

  const mTotal = mean(correctedEssays.map((e) => e.score));
  const mC1 = mean(correctedEssays.map((e) => e.c1));
  const mC2 = mean(correctedEssays.map((e) => e.c2));
  const mC3 = mean(correctedEssays.map((e) => e.c3));
  const mC4 = mean(correctedEssays.map((e) => e.c4));
  const mC5 = mean(correctedEssays.map((e) => e.c5));

  return { mTotal, mC1, mC2, mC3, mC4, mC5, hasCorrected: correctedEssays.length > 0 };
}

function renderStudentsForTask(taskId, taskTitle) {
  if (!studentsList) return;

  closeAllInlinePanels();
  studentsList.innerHTML = '';

  const filtered = cachedData.filter(
    (e) => String(e.taskId || e.task?.id || '') === String(taskId),
  );
  const students = groupByStudent(filtered);

  if (students.length === 0) {
    studentsList.innerHTML = '<li>Nenhum envio para esta tarefa.</li>';
    return;
  }

  students.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'mk-student-item';
    li.style.listStyle = 'none';

    const left = document.createElement('div');
    left.className = 'mk-student-left';

    const avatar = makeAvatar(s.studentId, 38);

    const info = document.createElement('div');
    info.className = 'mk-student-info';

    const nome = s.studentName && String(s.studentName).trim() ? s.studentName : 'Aluno';
    const email = s.studentEmail && String(s.studentEmail).trim() ? s.studentEmail : '';

    const header = document.createElement('div');
    header.innerHTML = `<strong>${nome}</strong>${
      email ? `<br><small class="mk-muted">${email}</small>` : ''
    }`;

    const medias = computeStudentAverages(s);

    const resumo = document.createElement('div');
    resumo.className = 'mk-muted';
    resumo.style.marginTop = '6px';
    resumo.textContent =
      `Média: ${medias.mTotal ?? '—'} | ` +
      `C1 ${medias.mC1 ?? '—'} C2 ${medias.mC2 ?? '—'} C3 ${medias.mC3 ?? '—'} C4 ${
        medias.mC4 ?? '—'
      } C5 ${medias.mC5 ?? '—'}`;

    info.appendChild(header);
    info.appendChild(resumo);

    left.appendChild(avatar);
    left.appendChild(info);

    const chartWrap = document.createElement('div');
    chartWrap.className = 'mk-chart-wrap';

    const donutBox = document.createElement('div');
    donutBox.className = 'mk-donut';

    const donutData = {
      c1: medias.mC1 ?? 0,
      c2: medias.mC2 ?? 0,
      c3: medias.mC3 ?? 0,
      c4: medias.mC4 ?? 0,
      c5: medias.mC5 ?? 0,
      total: medias.mTotal,
    };

    const { svg, legend } = createDonutSVG(donutData, 120, 18);
    svg.classList.add('mk-donut');
    donutBox.appendChild(svg);

    const legendEl = buildLegendGrid(legend);

    chartWrap.appendChild(donutBox);
    chartWrap.appendChild(legendEl);

    const actions = document.createElement('div');
    actions.className = 'mk-student-actions';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ver desempenho individual';

    const inlinePanel = buildInlinePanel();

    function toggleInline() {
      const isOpen = inlinePanel.style.display === 'block';
      closeAllInlinePanels();

      if (!isOpen) {
        fillInlinePanel(inlinePanel, s, {
          mTotal: medias.mTotal,
          mC1: medias.mC1,
          mC2: medias.mC2,
          mC3: medias.mC3,
          mC4: medias.mC4,
          mC5: medias.mC5,
        });
        inlinePanel.style.display = 'block';
      }
    }

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleInline();
    });

    li.style.cursor = 'pointer';
    li.title = 'Clique para ver o desempenho individual';
    li.addEventListener('click', (ev) => {
      if (ev.target && ev.target.tagName === 'BUTTON') return;
      toggleInline();
    });

    actions.appendChild(btn);

    li.appendChild(left);
    li.appendChild(chartWrap);
    li.appendChild(actions);

    const wrapBelow = document.createElement('div');
    wrapBelow.style.width = '100%';
    wrapBelow.style.marginTop = '10px';
    wrapBelow.appendChild(inlinePanel);

    const outer = document.createElement('div');
    outer.style.display = 'flex';
    outer.style.flexDirection = 'column';
    outer.style.gap = '8px';
    outer.appendChild(li);
    outer.appendChild(wrapBelow);

    const outerLi = document.createElement('li');
    outerLi.style.listStyle = 'none';
    outerLi.appendChild(outer);

    studentsList.appendChild(outerLi);
  });
}

function openTaskPanel(taskId, title) {
  if (!taskPanelEl) return;

  taskPanelEl.style.display = 'block';

  if (taskPanelTitleEl) taskPanelTitleEl.textContent = title || 'Tarefa';
  if (taskPanelMetaEl) taskPanelMetaEl.textContent = 'Gráfico em rosca: C1–C5 + margem até 1000.';

  renderStudentsForTask(taskId, title);

  taskPanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTaskPanel() {
  if (!taskPanelEl) return;
  taskPanelEl.style.display = 'none';
  closeAllInlinePanels();
  if (studentsList) studentsList.innerHTML = '';
}

// ---------------- carregar dados sala ----------------

async function carregarDados(session) {
  try {
    setStatus('Carregando...');

    cachedActiveSet = await getActiveStudentsSetAuth(session);

    // tenta carregar tasks para identificar “mais recente” com createdAt
    cachedTasksMeta = normalizeTasksMeta(await fetchTasksByRoomAuth(session));
    cachedNewestTaskId = computeNewestTaskIdFromTasksMeta(cachedTasksMeta);

    const dataRaw = await authFetch(
      `/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`,
      { token: session.token },
    );

    let data = unwrapResult(dataRaw);
    if (!Array.isArray(data)) data = [];

    if (!Array.isArray(data) || data.length === 0) {
      setStatus('Ainda não há redações nesta sala.');
      setText(avgTotal, null);
      setText(avgC1, null);
      setText(avgC2, null);
      setText(avgC3, null);
      setText(avgC4, null);
      setText(avgC5, null);

      renderRoomAverageDonut({ mC1: null, mC2: null, mC3: null, mC4: null, mC5: null, mTotal: null });
      renderTasksList([]);
      closeTaskPanel();
      return;
    }

    // filtra apenas alunos ativos
    if (cachedActiveSet && cachedActiveSet.size > 0) {
      data = data.filter((e) => cachedActiveSet.has(String(e.studentId)));
    }

    cachedData = data;

    // se tasks não tinham createdAt, tenta inferir pela data de envio das redações
    if (!cachedNewestTaskId) {
      cachedNewestTaskId = computeNewestTaskIdFromEssays(data);
    }

    // fallback final
    if (!cachedNewestTaskId) {
      const anyTask = data.find((e) => e.taskId || e.task?.id);
      cachedNewestTaskId = anyTask ? String(anyTask.taskId || anyTask.task?.id) : null;
    }

    // médias gerais da sala (somente corrigidas)
    const corrected = data.filter((e) => e.score !== null && e.score !== undefined);

    const mTotal = mean(corrected.map((e) => e.score));
    const mC1 = mean(corrected.map((e) => e.c1));
    const mC2 = mean(corrected.map((e) => e.c2));
    const mC3 = mean(corrected.map((e) => e.c3));
    const mC4 = mean(corrected.map((e) => e.c4));
    const mC5 = mean(corrected.map((e) => e.c5));

    setText(avgTotal, mTotal);
    setText(avgC1, mC1);
    setText(avgC2, mC2);
    setText(avgC3, mC3);
    setText(avgC4, mC4);
    setText(avgC5, mC5);

    renderRoomAverageDonut({ mC1, mC2, mC3, mC4, mC5, mTotal });

    // tarefas
    const tasks = buildTasksFromData(data);

    // se a “mais recente” veio de /tasks/by-room mas não tem redações, não destaca
    if (cachedNewestTaskId && !tasks.some((t) => String(t.taskId) === String(cachedNewestTaskId))) {
      cachedNewestTaskId = null;
    }

    if (!cachedNewestTaskId && tasks.length) {
      cachedNewestTaskId = tasks[0].taskId;
    }

    renderTasksList(tasks);

    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar dados de desempenho.');
    renderTasksList([]);
    closeTaskPanel();
  }
}

// ---------------- init ----------------

if (closeTaskPanelBtn) {
  closeTaskPanelBtn.addEventListener('click', () => closeTaskPanel());
}

(function init() {
  const session = requireProfessorSession();
  carregarSala(session);
  carregarDados(session);
})();
