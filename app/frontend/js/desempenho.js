import { API_URL } from './config.js';

// ✅ aluno logado
const studentId = localStorage.getItem('studentId');
if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.replace('login-aluno.html');
  throw new Error('studentId ausente');
}

const params = new URLSearchParams(window.location.search);
const roomIdFromUrl = params.get('roomId') || '';

const roomSelect = document.getElementById('roomSelect');
const statusEl = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

const chartEl = document.getElementById('chart');
const historyList = document.getElementById('historyList');

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

function mean(nums) {
  const v = nums
    .map((n) => (n === null || n === undefined ? null : Number(n)))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function clearResumo() {
  setText(avgTotal, null);
  setText(avgC1, null);
  setText(avgC2, null);
  setText(avgC3, null);
  setText(avgC4, null);
  setText(avgC5, null);
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function safeScore(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// rótulo simples (sem backend extra)
function makeLabelFromTaskId(taskId, idx) {
  const short = (taskId || '').slice(0, 6);
  return taskId ? `Tarefa ${short}…` : `Redação ${idx + 1}`;
}

function renderChart(essays) {
  if (!chartEl) return;
  chartEl.innerHTML = '';

  if (!Array.isArray(essays) || essays.length === 0) {
    chartEl.textContent = 'Sem redações ainda.';
    return;
  }

  const MAX = 1000;

  // cores fixas (depois a gente passa pro CSS se quiser)
  const COLORS = {
    c1: '#4f46e5',
    c2: '#16a34a',
    c3: '#f59e0b',
    c4: '#0ea5e9',
    c5: '#ef4444',
    gap: '#ffffff',       // margem de evolução (branco)
    stroke: '#e5e7eb',    // bordas/contorno
    text: '#0b1220',
    muted: '#334155',
  };

  function clamp0to200(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(200, v));
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  }

  function createDonutSvg(segments, opts = {}) {
    const size = opts.size ?? 72;
    const hole = opts.hole ?? 24;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    // base
    const base = document.createElementNS(svgNS, 'circle');
    base.setAttribute('cx', String(cx));
    base.setAttribute('cy', String(cy));
    base.setAttribute('r', String(r));
    base.setAttribute('fill', '#fff');
    base.setAttribute('stroke', COLORS.stroke);
    base.setAttribute('stroke-width', '1');
    svg.appendChild(base);

    const total = segments.reduce((a, s) => a + s.value, 0);
    if (total <= 0) return svg;

    let angle = 0;
    segments.forEach((seg) => {
      const portion = seg.value / total;
      const delta = portion * 360;
      const start = angle;
      const end = angle + delta;

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', arcPath(cx, cy, r, start, end));
      path.setAttribute('fill', seg.color);
      path.setAttribute('stroke', COLORS.stroke);
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);

      angle += delta;
    });

    // “furo” do donut
    const holeCircle = document.createElementNS(svgNS, 'circle');
    holeCircle.setAttribute('cx', String(cx));
    holeCircle.setAttribute('cy', String(cy));
    holeCircle.setAttribute('r', String(hole));
    holeCircle.setAttribute('fill', '#fff');
    svg.appendChild(holeCircle);

    // texto central (nota)
    if (typeof opts.centerText === 'string' && opts.centerText) {
      const t1 = document.createElementNS(svgNS, 'text');
      t1.setAttribute('x', String(cx));
      t1.setAttribute('y', String(cy + 4));
      t1.setAttribute('text-anchor', 'middle');
      t1.setAttribute('font-size', '12');
      t1.setAttribute('font-weight', '900');
      t1.setAttribute('fill', COLORS.text);
      t1.textContent = opts.centerText;
      svg.appendChild(t1);
    }

    return svg;
  }

  function legendItem(label, color) {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.fontSize = '12px';

    const dot = document.createElement('span');
    dot.style.display = 'inline-block';
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '3px';
    dot.style.background = color;
    dot.style.border = `1px solid ${COLORS.stroke}`;

    const text = document.createElement('span');
    text.textContent = label;

    item.appendChild(dot);
    item.appendChild(text);
    return item;
  }

  essays.forEach((e, idx) => {
    const score = safeScore(e.score);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '14px';
    row.style.margin = '10px 0';
    row.style.padding = '12px';
    row.style.border = '1px solid #e5e7eb';
    row.style.borderRadius = '16px';
    row.style.background = '#fff';
    row.style.boxShadow = '0 8px 18px rgba(2, 6, 23, 0.05)';

    // clicável
    row.style.cursor = 'pointer';
    row.title = 'Clique para ver a redação';
    row.addEventListener('click', () => {
      window.location.href = `ver-redacao.html?essayId=${encodeURIComponent(e.id)}`;
    });

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '14px';
    left.style.flex = '1';

    const label = document.createElement('div');
    label.style.minWidth = '140px';
    label.style.fontSize = '12px';
    label.style.opacity = '0.9';
    label.innerHTML = `<strong>${makeLabelFromTaskId(e.taskId, idx)}</strong>`;

    left.appendChild(label);

    const pieWrap = document.createElement('div');
    pieWrap.style.display = 'flex';
    pieWrap.style.alignItems = 'center';
    pieWrap.style.gap = '16px';
    pieWrap.style.flexWrap = 'wrap';

    if (score === null) {
      const not = document.createElement('div');
      not.style.fontSize = '12px';
      not.style.opacity = '0.8';
      not.textContent = 'Ainda não corrigida.';
      pieWrap.appendChild(not);
    } else {
      const c1 = clamp0to200(e.c1);
      const c2 = clamp0to200(e.c2);
      const c3 = clamp0to200(e.c3);
      const c4 = clamp0to200(e.c4);
      const c5 = clamp0to200(e.c5);

      const used = Math.max(0, Math.min(MAX, c1 + c2 + c3 + c4 + c5));
      const gap = Math.max(0, MAX - used);

      const segments = [
        { value: c1, color: COLORS.c1 },
        { value: c2, color: COLORS.c2 },
        { value: c3, color: COLORS.c3 },
        { value: c4, color: COLORS.c4 },
        { value: c5, color: COLORS.c5 },
        { value: gap, color: COLORS.gap }, // margem
      ].filter((s) => s.value > 0);

      const donut = createDonutSvg(segments, {
        size: 78,
        hole: 26,
        centerText: String(score),
      });
      pieWrap.appendChild(donut);

      const legend = document.createElement('div');
      legend.style.display = 'grid';
      legend.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      legend.style.columnGap = '16px';
      legend.style.rowGap = '6px';
      legend.style.minWidth = '280px';

      legend.appendChild(legendItem(`C1 (${c1})`, COLORS.c1));
      legend.appendChild(legendItem(`C2 (${c2})`, COLORS.c2));
      legend.appendChild(legendItem(`C3 (${c3})`, COLORS.c3));
      legend.appendChild(legendItem(`C4 (${c4})`, COLORS.c4));
      legend.appendChild(legendItem(`C5 (${c5})`, COLORS.c5));
      legend.appendChild(legendItem(`Margem de evolução (${gap})`, COLORS.gap));

      pieWrap.appendChild(legend);
    }

    left.appendChild(pieWrap);

    const right = document.createElement('div');
    right.style.width = '96px';
    right.style.textAlign = 'right';
    right.style.fontSize = '12px';
    right.innerHTML = score === null ? '—' : `<strong>${score}</strong> / 1000`;

    row.appendChild(left);
    row.appendChild(right);

    chartEl.appendChild(row);
  });
}



function renderHistory(essays) {
  if (!historyList) return;
  historyList.innerHTML = '';

  if (!Array.isArray(essays) || essays.length === 0) {
    historyList.innerHTML = '<li>Você ainda não enviou redações nesta sala.</li>';
    return;
  }

  // mantém ordem do backend
  const ordered = [...essays];

  ordered.forEach((e, idx) => {
    const li = document.createElement('li');

    const title = document.createElement('div');
    title.innerHTML = `<strong>${makeLabelFromTaskId(e.taskId, idx)}</strong>`;

    const nota = document.createElement('div');
    nota.style.marginTop = '6px';

    const score = safeScore(e.score);

    if (score !== null) {
      nota.textContent =
        `Nota: ${score} ` +
        `(C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${e.c4 ?? '—'} C5 ${
          e.c5 ?? '—'
        })`;
    } else {
      nota.textContent = 'Ainda não corrigida.';
    }

    const actions = document.createElement('div');
    actions.style.marginTop = '10px';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação';
    btn.onclick = () => {
      window.location.href = `ver-redacao.html?essayId=${encodeURIComponent(e.id)}`;
    };

    actions.appendChild(btn);

    li.appendChild(title);
    li.appendChild(nota);
    li.appendChild(actions);

    historyList.appendChild(li);
  });
}

// ✅ carrega salas do aluno (popular select)
async function carregarSalasDoAluno() {
  if (!roomSelect) return [];

  roomSelect.innerHTML = `<option value="">Carregando...</option>`;

  try {
    const res = await fetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`
    );
    if (!res.ok) throw new Error();

    const rooms = await res.json();
    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomSelect.innerHTML = `<option value="">(você não está em nenhuma sala)</option>`;
      return [];
    }

    roomSelect.innerHTML = '';

    rooms.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name || 'Sala';
      roomSelect.appendChild(opt);
    });

    const exists = rooms.some((r) => r.id === roomIdFromUrl);
    roomSelect.value = exists ? roomIdFromUrl : rooms[0].id;

    return rooms;
  } catch {
    roomSelect.innerHTML = `<option value="">Erro ao carregar salas</option>`;
    return [];
  }
}

// ✅ carrega desempenho do aluno na sala
async function carregarDesempenho(roomId) {
  if (!roomId) {
    setStatus('Selecione uma sala.');
    clearResumo();
    renderChart([]);
    renderHistory([]);
    return;
  }

  setStatus('Carregando...');
  clearResumo();
  renderChart([]);
  renderHistory([]);

  try {
    const res = await fetch(
      `${API_URL}/essays/performance/by-room-for-student?roomId=${encodeURIComponent(
        roomId
      )}&studentId=${encodeURIComponent(studentId)}`
    );
    if (!res.ok) throw new Error();

    const essays = await res.json();

    if (!Array.isArray(essays) || essays.length === 0) {
      setStatus('Sem redações nesta sala ainda.');
      renderChart([]);
      renderHistory([]);
      return;
    }

    const corrected = essays.filter((e) => e.score !== null && e.score !== undefined);

    setText(avgTotal, mean(corrected.map((e) => e.score)));
    setText(avgC1, mean(corrected.map((e) => e.c1)));
    setText(avgC2, mean(corrected.map((e) => e.c2)));
    setText(avgC3, mean(corrected.map((e) => e.c3)));
    setText(avgC4, mean(corrected.map((e) => e.c4)));
    setText(avgC5, mean(corrected.map((e) => e.c5)));

    renderChart(essays);
    renderHistory(essays);

    setStatus('');
  } catch {
    setStatus('Erro ao carregar desempenho.');
    renderChart([]);
    renderHistory([]);
  }
}

// INIT
(async () => {
  const rooms = await carregarSalasDoAluno();

  if (roomSelect) {
    roomSelect.addEventListener('change', () => {
      const rid = roomSelect.value || '';
      const url = new URL(window.location.href);
      url.searchParams.set('roomId', rid);
      window.history.replaceState({}, '', url);
      carregarDesempenho(rid);
    });
  }

  if (rooms.length > 0) {
    carregarDesempenho(roomSelect.value);
  } else {
    setStatus('Você não está matriculado em nenhuma sala.');
  }
})();


