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

const avgDonutEl = document.getElementById('avgDonut');
const avgLegendEl = document.getElementById('avgLegend');

const historyList = document.getElementById('historyList');

// ---------------- util ----------------
function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

function mean(nums) {
  const v = (Array.isArray(nums) ? nums : [])
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
  if (avgDonutEl) avgDonutEl.innerHTML = '';
  if (avgLegendEl) avgLegendEl.innerHTML = '';
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function safeScore(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function clamp0to200(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(200, v));
}

// ---------------- DATAS (robusto) ----------------
function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const d2 = new Date(asNum);
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

// ---------------- Donut (mesmo estilo do projeto) ----------------
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
  const size = opts.size ?? 96;
  const hole = opts.hole ?? 32;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

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

  const holeCircle = document.createElementNS(svgNS, 'circle');
  holeCircle.setAttribute('cx', String(cx));
  holeCircle.setAttribute('cy', String(cy));
  holeCircle.setAttribute('r', String(hole));
  holeCircle.setAttribute('fill', '#fff');
  svg.appendChild(holeCircle);

  if (typeof opts.centerText === 'string' && opts.centerText) {
    const t1 = document.createElementNS(svgNS, 'text');
    t1.setAttribute('x', String(cx));
    t1.setAttribute('y', String(cy + 5));
    t1.setAttribute('text-anchor', 'middle');
    t1.setAttribute('font-size', String(opts.fontSize ?? 14));
    t1.setAttribute('font-weight', '900');
    t1.setAttribute('fill', COLORS.text);
    t1.textContent = opts.centerText;
    svg.appendChild(t1);
  }

  return svg;
}

function legendItem(label, color, isGap = false) {
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
  dot.style.border = `1px solid ${isGap ? '#d1d5db' : COLORS.stroke}`;

  const text = document.createElement('span');
  text.textContent = label;

  item.appendChild(dot);
  item.appendChild(text);
  return item;
}

function renderDonutWithLegend(targetDonutEl, targetLegendEl, { c1, c2, c3, c4, c5, totalText }) {
  if (!targetDonutEl || !targetLegendEl) return;

  const used = Math.max(0, Math.min(MAX, c1 + c2 + c3 + c4 + c5));
  const gap = Math.max(0, MAX - used);

  const segments = [
    { value: c1, color: COLORS.c1 },
    { value: c2, color: COLORS.c2 },
    { value: c3, color: COLORS.c3 },
    { value: c4, color: COLORS.c4 },
    { value: c5, color: COLORS.c5 },
    { value: gap, color: COLORS.gap },
  ].filter((s) => s.value > 0);

  targetDonutEl.innerHTML = '';
  targetLegendEl.innerHTML = '';

  const donut = createDonutSvg(segments, {
    size: 92,
    hole: 30,
    centerText: totalText,
    fontSize: 14,
  });

  targetDonutEl.appendChild(donut);

  const legend = document.createElement('div');
  legend.style.display = 'grid';
  legend.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  legend.style.columnGap = '16px';
  legend.style.rowGap = '6px';

  legend.appendChild(legendItem(`C1 (${c1})`, COLORS.c1));
  legend.appendChild(legendItem(`C2 (${c2})`, COLORS.c2));
  legend.appendChild(legendItem(`C3 (${c3})`, COLORS.c3));
  legend.appendChild(legendItem(`C4 (${c4})`, COLORS.c4));
  legend.appendChild(legendItem(`C5 (${c5})`, COLORS.c5));
  legend.appendChild(legendItem(`Margem de evolução (${gap})`, COLORS.gap, true));

  targetLegendEl.appendChild(legend);
}

// ---------------- tarefas: buscar títulos + createdAt ----------------
async function fetchTasksMetaByRoom(roomId) {
  try {
    const res = await fetch(`${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`);
    if (!res.ok) return [];
    const tasks = await res.json();
    return Array.isArray(tasks) ? tasks : [];
  } catch {
    return [];
  }
}

function buildTasksMap(tasksArr) {
  const map = new Map();
  (Array.isArray(tasksArr) ? tasksArr : []).forEach((t) => {
    if (t?.id) map.set(String(t.id), String(t.title || 'Tarefa'));
  });
  return map;
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

function computeNewestTaskIdFromEssays(essays) {
  const mapMax = new Map(); // taskId -> maxTime

  (Array.isArray(essays) ? essays : []).forEach((e) => {
    const tId = String(e?.taskId || '').trim();
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

// ---------------- UI: tarefas com abrir/fechar ----------------
function closeAllTaskPanels() {
  if (!historyList) return;
  const panels = historyList.querySelectorAll('.mk-task-panel');
  panels.forEach((p) => (p.style.display = 'none'));
}

function buildTaskPanel() {
  const panel = document.createElement('div');
  panel.className = 'mk-task-panel';
  panel.style.display = 'none';
  panel.style.marginTop = '10px';
  panel.style.padding = '12px';
  panel.style.border = '1px solid #e5e7eb';
  panel.style.borderRadius = '14px';
  panel.style.background = '#fff';

  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.justifyContent = 'space-between';
  head.style.gap = '10px';

  const title = document.createElement('strong');
  title.id = 'mkTaskPanelTitle';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fechar';
  closeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    panel.style.display = 'none';
  });

  head.appendChild(title);
  head.appendChild(closeBtn);

  const chartWrap = document.createElement('div');
  chartWrap.style.display = 'flex';
  chartWrap.style.alignItems = 'center';
  chartWrap.style.gap = '18px';
  chartWrap.style.flexWrap = 'wrap';
  chartWrap.style.marginTop = '10px';

  const donut = document.createElement('div');
  donut.id = 'mkTaskPanelDonut';
  donut.style.minWidth = '160px';
  donut.style.display = 'flex';
  donut.style.justifyContent = 'center';

  const legend = document.createElement('div');
  legend.id = 'mkTaskPanelLegend';

  chartWrap.appendChild(donut);
  chartWrap.appendChild(legend);

  const actions = document.createElement('div');
  actions.style.marginTop = '12px';

  const viewBtn = document.createElement('button');
  viewBtn.id = 'mkTaskPanelViewBtn';
  viewBtn.textContent = 'Ver redação';
  actions.appendChild(viewBtn);

  panel.appendChild(head);
  panel.appendChild(chartWrap);
  panel.appendChild(actions);

  return panel;
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

function renderTasksHistory(essays, tasksMap, newestTaskId = null) {
  if (!historyList) return;
  historyList.innerHTML = '';

  if (!Array.isArray(essays) || essays.length === 0) {
    historyList.innerHTML = '<li>Você ainda não enviou redações nesta sala.</li>';
    return;
  }

  const byTask = new Map();
  essays.forEach((e) => {
    const tId = e?.taskId ? String(e.taskId) : '';
    if (!tId) return;
    if (!byTask.has(tId)) byTask.set(tId, []);
    byTask.get(tId).push(e);
  });

  let tasks = Array.from(byTask.entries()).map(([taskId, list]) => {
    const title = tasksMap.get(taskId) || `Tarefa ${taskId.slice(0, 6)}…`;
    return { taskId, title, list };
  });

  // ✅ mais recente no topo; resto por nome
  tasks.sort((a, b) => {
    if (newestTaskId) {
      const aIs = String(a.taskId) === String(newestTaskId) ? 1 : 0;
      const bIs = String(b.taskId) === String(newestTaskId) ? 1 : 0;
      if (aIs !== bIs) return bIs - aIs;
    }
    return a.title.localeCompare(b.title);
  });

  tasks.forEach((t) => {
    const isNewest = newestTaskId && String(t.taskId) === String(newestTaskId);

    const li = document.createElement('li');
    li.style.padding = '12px';
    li.style.borderRadius = '14px';
    li.style.border = '1px solid #e5e7eb';
    li.style.background = '#fff';
    li.style.boxShadow = '0 8px 18px rgba(2, 6, 23, 0.05)';

    // ✅ destaque visual no card mais recente
    if (isNewest) {
      li.style.border = '2px solid rgba(109,40,217,.35)';
      li.style.boxShadow = '0 10px 24px rgba(109,40,217,0.12)';
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

    const essay = t.list[0];

    const score = safeScore(essay?.score);
    const resumo = document.createElement('div');
    resumo.style.marginTop = '6px';
    resumo.style.fontSize = '12px';
    resumo.style.opacity = '0.9';
    resumo.textContent = score === null ? 'Ainda não corrigida.' : `Nota: ${score} / 1000`;

    const btn = document.createElement('button');
    btn.style.marginTop = '10px';
    btn.textContent = 'Ver detalhes da tarefa';

    const panel = buildTaskPanel();

    function openPanel() {
      closeAllTaskPanels();

      const panelTitle = panel.querySelector('#mkTaskPanelTitle');
      if (panelTitle) panelTitle.textContent = t.title;

      const donut = panel.querySelector('#mkTaskPanelDonut');
      const legend = panel.querySelector('#mkTaskPanelLegend');

      if (score === null) {
        if (donut) donut.innerHTML = '<div style="font-size:12px;opacity:.8;">Sem correção ainda.</div>';
        if (legend) legend.innerHTML = '';
      } else {
        const c1 = clamp0to200(essay?.c1);
        const c2 = clamp0to200(essay?.c2);
        const c3 = clamp0to200(essay?.c3);
        const c4 = clamp0to200(essay?.c4);
        const c5 = clamp0to200(essay?.c5);
        renderDonutWithLegend(donut, legend, { c1, c2, c3, c4, c5, totalText: String(score) });
      }

      const viewBtn = panel.querySelector('#mkTaskPanelViewBtn');
      if (viewBtn) {
        viewBtn.onclick = (ev) => {
          ev.stopPropagation();
          window.location.href = `ver-redacao.html?essayId=${encodeURIComponent(essay.id)}`;
        };
      }

      panel.style.display = 'block';
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = panel.style.display === 'block';
      if (isOpen) panel.style.display = 'none';
      else openPanel();
    });

    li.style.cursor = 'pointer';
    li.title = 'Clique para abrir/fechar os detalhes';
    li.addEventListener('click', (ev) => {
      if (ev.target && ev.target.tagName === 'BUTTON') return;
      const isOpen = panel.style.display === 'block';
      if (isOpen) panel.style.display = 'none';
      else openPanel();
    });

    li.appendChild(titleWrap);
    li.appendChild(resumo);
    li.appendChild(btn);
    li.appendChild(panel);

    historyList.appendChild(li);

    // ✅ opcional: você pode autoabrir o mais recente (descomente)
    // if (isNewest) openPanel();
  });
}

// ---------------- salas do aluno ----------------
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

    const exists = rooms.some((r) => String(r.id) === String(roomIdFromUrl));
    roomSelect.value = exists ? roomIdFromUrl : rooms[0].id;

    return rooms;
  } catch {
    roomSelect.innerHTML = `<option value="">Erro ao carregar salas</option>`;
    return [];
  }
}

// ---------------- desempenho do aluno na sala ----------------
async function carregarDesempenho(roomId) {
  if (!roomId) {
    setStatus('Selecione uma sala.');
    clearResumo();
    renderTasksHistory([], new Map(), null);
    return;
  }

  setStatus('Carregando...');
  clearResumo();
  renderTasksHistory([], new Map(), null);

  try {
    // 1) desempenho do aluno
    const res = await fetch(
      `${API_URL}/essays/performance/by-room-for-student?roomId=${encodeURIComponent(
        roomId
      )}&studentId=${encodeURIComponent(studentId)}`
    );
    if (!res.ok) throw new Error();

    const essays = await res.json();

    if (!Array.isArray(essays) || essays.length === 0) {
      setStatus('Sem redações nesta sala ainda.');
      renderTasksHistory([], new Map(), null);
      return;
    }

    // 2) tarefas da sala (títulos + possível createdAt)
    const tasksRaw = await fetchTasksMetaByRoom(roomId);
    const tasksMeta = normalizeTasksMeta(tasksRaw);
    const tasksMap = buildTasksMap(tasksRaw);

    // 3) calcula tarefa mais recente
    let newestTaskId = computeNewestTaskIdFromTasksMeta(tasksMeta);

    // se não tem createdAt, tenta pelo envio das redações
    if (!newestTaskId) newestTaskId = computeNewestTaskIdFromEssays(essays);

    // fallback: primeira task presente nas redações
    if (!newestTaskId) {
      const first = essays.find((e) => e?.taskId);
      newestTaskId = first ? String(first.taskId) : null;
    }

    // 3) resumo (somente corrigidas)
    const corrected = essays.filter((e) => e.score !== null && e.score !== undefined);

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

    // ✅ gráfico do resumo (média geral)
    if (mTotal !== null) {
      renderDonutWithLegend(avgDonutEl, avgLegendEl, {
        c1: mC1 ?? 0,
        c2: mC2 ?? 0,
        c3: mC3 ?? 0,
        c4: mC4 ?? 0,
        c5: mC5 ?? 0,
        totalText: String(mTotal),
      });
    } else {
      if (avgDonutEl)
        avgDonutEl.innerHTML = '<div style="font-size:12px;opacity:.8;">Sem correções ainda.</div>';
      if (avgLegendEl) avgLegendEl.innerHTML = '';
    }

    // 4) histórico por tarefa (com destaque da mais recente)
    renderTasksHistory(essays, tasksMap, newestTaskId);

    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao carregar desempenho.');
    renderTasksHistory([], new Map(), null);
  }
}

const downloadPdfBtn = document.getElementById('downloadPdfBtn');

async function baixarPdf(roomId) {
  if (!roomId) {
    alert('Selecione uma sala primeiro.');
    return;
  }

  const url =
    `${API_URL}/pdf/performance/student` +
    `?roomId=${encodeURIComponent(roomId)}` +
    `&studentId=${encodeURIComponent(studentId)}`;

  try {
    downloadPdfBtn && (downloadPdfBtn.disabled = true);
    if (statusEl) statusEl.textContent = 'Gerando PDF...';

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();

    const a = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = `desempenho-${roomId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    if (statusEl) statusEl.textContent = 'Erro ao gerar PDF.';
  } finally {
    downloadPdfBtn && (downloadPdfBtn.disabled = false);
  }
}

if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', () => {
    const roomId = roomSelect?.value || '';
    baixarPdf(roomId);
  });
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

