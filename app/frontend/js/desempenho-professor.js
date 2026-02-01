import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'professor-salas.html';
  throw new Error('roomId ausente');
}

const roomNameEl = document.getElementById('roomName');
const statusEl = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

const tasksListEl = document.getElementById('tasksList');
const taskPanelEl = document.getElementById('taskPanel');
const taskPanelTitleEl = document.getElementById('taskPanelTitle');
const taskPanelMetaEl = document.getElementById('taskPanelMeta');
const closeTaskPanelBtn = document.getElementById('closeTaskPanelBtn');

const studentsList = document.getElementById('studentsList');

// ---------------- utils ----------------

function mean(nums) {
  const v = (Array.isArray(nums) ? nums : [])
    .map((n) => (n === null || n === undefined ? null : Number(n)))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
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
  img.style.display = 'none';

  const dataUrl = getStudentPhotoDataUrl(studentId);
  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'inline-block';
  } else {
    // placeholder simples
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eee"/>
          <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">?</text>
        </svg>`
      );
    img.style.display = 'inline-block';
  }

  return img;
}

// ---------------- donut (estilo sua imagem) ----------------

// cores fixas para manter padrão
const DONUT_COLORS = {
  c1: '#4f46e5',  // roxo/azul
  c2: '#16a34a',  // verde
  c3: '#f59e0b',  // laranja
  c4: '#0ea5e9',  // azul claro
  c5: '#ef4444',  // vermelho
  margin: '#ffffff', // branco
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

  let offset = 0; // em unidades de circunferência

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  // fundo (anel “vazio”)
  const base = document.createElementNS(svgNS, 'circle');
  base.setAttribute('cx', String(cx));
  base.setAttribute('cy', String(cy));
  base.setAttribute('r', String(r));
  base.setAttribute('fill', 'none');
  base.setAttribute('stroke', 'rgba(0,0,0,0.08)');
  base.setAttribute('stroke-width', String(thickness));
  svg.appendChild(base);

  // segmentos
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

    // margem branca precisa de borda leve (igual sua imagem)
    if (seg.isMargin) {
      circle.setAttribute('stroke', DONUT_COLORS.margin);
      circle.setAttribute('stroke', DONUT_COLORS.margin);
      circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
      circle.setAttribute('stroke-dashoffset', String(-offset));
      circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      // stroke externo leve para “aparecer” no branco
      circle.style.filter = 'none';
      circle.setAttribute('stroke', DONUT_COLORS.margin);
      circle.setAttribute('stroke-opacity', '1');
      // desenha borda com outro círculo por cima
      const border = document.createElementNS(svgNS, 'circle');
      border.setAttribute('cx', String(cx));
      border.setAttribute('cy', String(cy));
      border.setAttribute('r', String(r));
      border.setAttribute('fill', 'none');
      border.setAttribute('stroke', DONUT_COLORS.marginStroke);
      border.setAttribute('stroke-width', '1');
      svg.appendChild(circle);
      svg.appendChild(border);
    } else {
      circle.setAttribute('stroke', seg.color);
      circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
      circle.setAttribute('stroke-dashoffset', String(-offset));
      circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      svg.appendChild(circle);
    }

    offset += segLen;
  });

  // texto central
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

  values.forEach((v) => {
    const item = document.createElement('div');
    item.className = 'mk-legend-item';

    const dot = document.createElement('span');
    dot.className = 'mk-dot';
    dot.style.background = v.color;

    // margem branca com borda pra não “sumir”
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

// ---------------- alunos ativos ----------------

async function getActiveStudentsSet() {
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/students`);
    if (!res.ok) throw new Error();

    const list = await res.json();
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
  info.id = 'mkInlineInfo';

  const h4 = document.createElement('h4');
  h4.textContent = 'Redações do aluno';
  h4.style.marginTop = '10px';

  const essaysUl = document.createElement('ul');
  essaysUl.className = 'lista';
  essaysUl.id = 'mkInlineEssays';

  wrap.appendChild(head);
  wrap.appendChild(info);
  wrap.appendChild(h4);
  wrap.appendChild(essaysUl);

  return wrap;
}

function fillInlinePanel(panel, studentGroup, medias) {
  if (!panel) return;

  const info = panel.querySelector('#mkInlineInfo');
  const essaysUl = panel.querySelector('#mkInlineEssays');

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
  essays.sort((a, b) => (a.taskTitle || '').localeCompare(b.taskTitle || ''));

  essays.forEach((e) => {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = e.taskTitle || 'Tarefa';

    const nota = document.createElement('div');
    nota.textContent =
      e.score !== null && e.score !== undefined
        ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${
            e.c4 ?? '—'
          } C5 ${e.c5 ?? '—'})`
        : 'Sem correção';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação/feedback';
    btn.onclick = () => {
      const tId = e.taskId || e.task?.id || null;
      if (!tId) {
        alert('Não encontrei o taskId desta redação no retorno do servidor.');
        return;
      }
      window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(
        tId
      )}&studentId=${encodeURIComponent(studentGroup.studentId)}`;
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

async function carregarSala() {
  if (!roomNameEl) return;
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) throw new Error();
    const room = await res.json();
    roomNameEl.textContent = room?.name || 'Sala';
  } catch {
    roomNameEl.textContent = 'Sala';
  }
}

// ---------------- dados e render ----------------

let cachedData = [];
let cachedActiveSet = null;

function buildTasksFromData(data) {
  const map = new Map();

  (Array.isArray(data) ? data : []).forEach((e) => {
    const tId = e.taskId || e.task?.id || null;
    const title = e.taskTitle || e.task?.title || 'Tarefa';

    if (!tId) return;

    if (!map.has(String(tId))) {
      map.set(String(tId), {
        taskId: String(tId),
        title,
        count: 0,
        correctedCount: 0,
      });
    }

    const g = map.get(String(tId));
    g.count += 1;
    if (e.score !== null && e.score !== undefined) g.correctedCount += 1;
  });

  const tasks = Array.from(map.values());
  tasks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return tasks;
}

function renderTasksList(tasks) {
  if (!tasksListEl) return;
  tasksListEl.innerHTML = '';

  if (!Array.isArray(tasks) || tasks.length === 0) {
    tasksListEl.innerHTML = `<div class="mk-muted">Nenhuma tarefa com redações ainda.</div>`;
    return;
  }

  tasks.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'mk-task-btn';
    btn.type = 'button';

    btn.innerHTML = `
      <strong>${t.title}</strong>
      <small>${t.count} envio(s) • ${t.correctedCount} corrigida(s)</small>
    `;

    btn.addEventListener('click', () => openTaskPanel(t.taskId, t.title));
    tasksListEl.appendChild(btn);
  });
}

function groupByStudent(data) {
  const byStudent = new Map();

  (Array.isArray(data) ? data : []).forEach((e) => {
    const sid = e.studentId;
    if (!sid) return;

    if (!byStudent.has(String(sid))) {
      byStudent.set(String(sid), {
        studentId: String(sid),
        studentName: e.studentName || '',
        studentEmail: e.studentEmail || '',
        essays: [],
      });
    }

    const g = byStudent.get(String(sid));
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
    (e) => e.score !== null && e.score !== undefined
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

  const filtered = cachedData.filter((e) => String(e.taskId || e.task?.id || '') === String(taskId));
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
    header.innerHTML = `<strong>${nome}</strong>${email ? `<br><small class="mk-muted">${email}</small>` : ''}`;

    const medias = computeStudentAverages(s);

    const resumo = document.createElement('div');
    resumo.className = 'mk-muted';
    resumo.style.marginTop = '6px';
    resumo.textContent =
      `Média: ${medias.mTotal ?? '—'} | ` +
      `C1 ${medias.mC1 ?? '—'} C2 ${medias.mC2 ?? '—'} C3 ${medias.mC3 ?? '—'} C4 ${medias.mC4 ?? '—'} C5 ${medias.mC5 ?? '—'}`;

    info.appendChild(header);
    info.appendChild(resumo);

    left.appendChild(avatar);
    left.appendChild(info);

    // ✅ “área em branco” ao lado: gráfico + legenda (estilo imagem)
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
      total: medias.mTotal, // se null, centro vira —
    };

    const { svg, legend } = createDonutSVG(donutData, 120, 18);
    svg.classList.add('mk-donut');
    donutBox.appendChild(svg);

    const legendEl = buildLegendGrid(legend);

    chartWrap.appendChild(donutBox);
    chartWrap.appendChild(legendEl);

    // ações + painel individual inline
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

    // clique no card também abre/fecha
    li.style.cursor = 'pointer';
    li.title = 'Clique para ver o desempenho individual';
    li.addEventListener('click', (ev) => {
      if (ev.target && ev.target.tagName === 'BUTTON') return;
      toggleInline();
    });

    actions.appendChild(btn);

    // compõe
    li.appendChild(left);
    li.appendChild(chartWrap);
    li.appendChild(actions);

    // painel inline fica “embaixo” (full width)
    const wrapBelow = document.createElement('div');
    wrapBelow.style.width = '100%';
    wrapBelow.style.marginTop = '10px';
    wrapBelow.appendChild(inlinePanel);

    // coloca abaixo do card
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

  // abre painel
  taskPanelEl.style.display = 'block';

  if (taskPanelTitleEl) taskPanelTitleEl.textContent = title || 'Tarefa';
  if (taskPanelMetaEl) taskPanelMetaEl.textContent = 'Gráfico em rosca: C1–C5 + margem até 1000.';

  // render alunos que enviaram
  renderStudentsForTask(taskId, title);

  // scroll até o painel
  taskPanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTaskPanel() {
  if (!taskPanelEl) return;
  taskPanelEl.style.display = 'none';
  closeAllInlinePanels();
  if (studentsList) studentsList.innerHTML = '';
}

// ---------------- carregar dados sala ----------------

async function carregarDados() {
  try {
    setStatus('Carregando...');

    cachedActiveSet = await getActiveStudentsSet();

    const res = await fetch(
      `${API_URL}/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`
    );
    if (!res.ok) throw new Error();

    let data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      setStatus('Ainda não há redações nesta sala.');
      setText(avgTotal, null);
      setText(avgC1, null);
      setText(avgC2, null);
      setText(avgC3, null);
      setText(avgC4, null);
      setText(avgC5, null);

      renderTasksList([]);
      closeTaskPanel();
      return;
    }

    // filtra apenas alunos ativos
    if (cachedActiveSet && cachedActiveSet.size > 0) {
      data = data.filter((e) => cachedActiveSet.has(String(e.studentId)));
    }

    cachedData = data;

    // médias gerais da sala (somente corrigidas)
    const corrected = data.filter((e) => e.score !== null && e.score !== undefined);
    setText(avgTotal, mean(corrected.map((e) => e.score)));
    setText(avgC1, mean(corrected.map((e) => e.c1)));
    setText(avgC2, mean(corrected.map((e) => e.c2)));
    setText(avgC3, mean(corrected.map((e) => e.c3)));
    setText(avgC4, mean(corrected.map((e) => e.c4)));
    setText(avgC5, mean(corrected.map((e) => e.c5)));

    // tarefas
    const tasks = buildTasksFromData(data);
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

carregarSala();
carregarDados();
