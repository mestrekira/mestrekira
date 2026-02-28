import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// ------------------- Elementos ----------------------
const roomAvgDonutEl = document.getElementById('roomAvgDonut');
const roomAvgLegendEl = document.getElementById('roomAvgLegend');
const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');
const tasksListEl = document.getElementById('tasksList');

// ------------------- Toast helpers -------------------
function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
    });
  } else {
    if (type === 'error') alert(`${title}\n\n${message}`);
    else console.log(title, message);
  }
}

function setStatus(msg) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg || '';
}

function setText(el, value) {
  if (el) el.textContent = value === null || value === undefined ? '—' : String(value);
}

// ------------------- Sessão (escola) -------------------

const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',
};

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function requireSchoolSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = String(user?.role || '').trim().toUpperCase();

  if (!token || role !== 'SCHOOL') {
    window.location.replace('login-escola.html');
    throw new Error('Sessão de escola ausente/inválida');
  }

  return { token, user };
}

// ------------------- Dados e renderização -------------------

async function fetchRoomData(roomId, token) {
  const data = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(res => res.json());

  return data;
}

async function fetchPerformanceData(roomId, token) {
  const data = await fetch(`${API_URL}/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(res => res.json());

  return data;
}

// ------------------ Renderizando o gráfico e os resumos ------------------

function createDonutSVG({ c1, c2, c3, c4, c5, total }, size = 120, thickness = 18) {
  const values = [
    { key: 'c1', label: `C1 (${c1 ?? 0})`, value: Number(c1 || 0), color: '#4f46e5' },
    { key: 'c2', label: `C2 (${c2 ?? 0})`, value: Number(c2 || 0), color: '#16a34a' },
    { key: 'c3', label: `C3 (${c3 ?? 0})`, value: Number(c3 || 0), color: '#f59e0b' },
    { key: 'c4', label: `C4 (${c4 ?? 0})`, value: Number(c4 || 0), color: '#0ea5e9' },
    { key: 'c5', label: `C5 (${c5 ?? 0})`, value: Number(c5 || 0), color: '#ef4444' },
  ];

  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : null;
  const margin = safeTotal === null ? 1000 : Math.max(0, 1000 - safeTotal);

  values.push({
    key: 'margin',
    label: `Margem de evolução (${margin})`,
    value: margin,
    color: '#ffffff',
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

    circle.setAttribute('stroke', seg.isMargin ? '#ffffff' : seg.color);
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
      border.setAttribute('stroke', '#d1d5db');
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

  return svg;
}

function renderRoomAverageDonut({ mC1, mC2, mC3, mC4, mC5, mTotal }) {
  if (!roomAvgDonutEl || !roomAvgLegendEl) return;

  roomAvgDonutEl.innerHTML = '';
  roomAvgLegendEl.innerHTML = '';

  const donutData = {
    c1: mC1 ?? 0,
    c2: mC2 ?? 0,
    c3: mC3 ?? 0,
    c4: mC4 ?? 0,
    c5: mC5 ?? 0,
    total: mTotal,
  };

  const svg = createDonutSVG(donutData);
  roomAvgDonutEl.appendChild(svg);

  roomAvgLegendEl.innerHTML = `
    <div><strong>C1</strong> — ${mC1 ?? 0}</div>
    <div><strong>C2</strong> — ${mC2 ?? 0}</div>
    <div><strong>C3</strong> — ${mC3 ?? 0}</div>
    <div><strong>C4</strong> — ${mC4 ?? 0}</div>
    <div><strong>C5</strong> — ${mC5 ?? 0}</div>
    <div><strong>Total</strong> — ${mTotal ?? 0}</div>
  `;
}

// ------------------- Carregar dados ---------------------

async function carregarDados(session) {
  try {
    setStatus('Carregando...');

    const roomData = await fetchRoomData(session.roomId, session.token);
    setText(document.getElementById('schoolName'), roomData?.name || 'Escola');

    const performanceData = await fetchPerformanceData(session.roomId, session.token);
    const media = performanceData?.media || {};

    renderRoomAverageDonut(media);

    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar dados.');
  }
}

// ------------------ Iniciar ----------------------------

document.addEventListener('DOMContentLoaded', () => {
  const session = requireSchoolSession();
  carregarDados(session);
});
