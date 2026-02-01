import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'professor-salas.html';
  throw new Error('roomId ausente');
}

// ---------- elementos ----------
const roomNameEl = document.getElementById('roomName');
const statusEl = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

const roomDonutEl = document.getElementById('roomDonut');
const roomDonutLegendEl = document.getElementById('roomDonutLegend');

const tasksBar = document.getElementById('tasksBar');
const taskInfo = document.getElementById('taskInfo');

const studentsList = document.getElementById('studentsList');

// ---------- util ----------
function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

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

function isCorrected(e) {
  return e && e.score !== null && e.score !== undefined;
}

// ---------- fotos localStorage ----------
function studentPhotoKey(studentId) {
  return studentId ? `mk_photo_student_${studentId}` : null;
}
function getStudentPhotoDataUrl(studentId) {
  const key = studentPhotoKey(studentId);
  return key ? localStorage.getItem(key) : null;
}
function makeAvatar(studentId, size = 42) {
  const img = document.createElement('img');
  img.alt = 'Foto do aluno';
  img.width = size;
  img.height = size;

  const dataUrl = getStudentPhotoDataUrl(studentId);
  if (dataUrl) {
    img.src = dataUrl;
  } else {
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eee"/>
          <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">?</text>
        </svg>`
      );
  }
  return img;
}

// ---------- donut (5 anéis concêntricos C1–C5) ----------
const COMP_COLORS = {
  c1: '#1f2937', // cinza escuro
  c2: '#2563eb', // azul
  c3: '#16a34a', // verde
  c4: '#f59e0b', // amarelo
  c5: '#dc2626', // vermelho
};

function pctFrom200(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n / 200));
}

function buildDonutSVG({ c1, c2, c3, c4, c5, centerText = '' }) {
  const values = {
    c1: pctFrom200(c1),
    c2: pctFrom200(c2),
    c3: pctFrom200(c3),
    c4: pctFrom200(c4),
    c5: pctFrom200(c5),
  };

  // SVG
  const size = 140;
  const cx = 70;
  const cy = 70;

  // 5 anéis (raios do maior para o menor)
  const rings = [
    { key: 'c1', r: 58, w: 10 },
    { key: 'c2', r: 46, w: 10 },
    { key: 'c3', r: 34, w: 10 },
    { key: 'c4', r: 22, w: 10 },
    { key: 'c5', r: 10, w: 10 },
  ];

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'mk-donut');

  const makeCircle = (r, stroke, dash, dashOffset, width, opacity = 1) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', stroke);
    c.setAttribute('stroke-width', String(width));
    c.setAttribute('stroke-linecap', 'round');
    c.setAttribute('opacity', String(opacity));
    if (dash) c.setAttribute('stroke-dasharray', dash);
    if (dashOffset !== null && dashOffset !== undefined) {
      c.setAttribute('stroke-dashoffset', String(dashOffset));
    }
    // inicia no topo (12h)
    c.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    return c;
  };

  rings.forEach((rg) => {
    const p = values[rg.key] ?? 0;
    const circumference = 2 * Math.PI * rg.r;
    const filled = circumference * p;
    const empty = Math.max(0, circumference - filled);

    // fundo (cinza claro)
    svg.appendChild(makeCircle(rg.r, '#e5e7eb', null, null, rg.w, 1));

    // progresso
    svg.appendChild(
      makeCircle(
        rg.r,
        COMP_COLORS[rg.key],
        `${filled} ${empty}`,
        0,
        rg.w,
        1
      )
    );
  });

  // texto central
  const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t1.setAttribute('x', String(cx));
  t1.setAttribute('y', String(cy + 5));
  t1.setAttribute('text-anchor', 'middle');
  t1.setAttribute('font-size', '14');
  t1.setAttribute('font-weight', '700');
  t1.textContent = centerText || '';
  svg.appendChild(t1);

  return svg;
}

function renderDonut(container, data, centerText) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(buildDonutSVG({ ...data, centerText }));
}

function renderLegend(container) {
  if (!container) return;
  container.innerHTML = `
    <div><span class="mk-dot" style="background:${COMP_COLORS.c1}"></span> C1</div>
    <div><span class="mk-dot" style="background:${COMP_COLORS.c2}"></span> C2</div>
    <div><span class="mk-dot" style="background:${COMP_COLORS.c3}"></span> C3</div>
    <div><span class="mk-dot" style="background:${COMP_COLORS.c4}"></span> C4</div>
    <div><span class="mk-dot" style="background:${COMP_COLORS.c5}"></span> C5</div>
  `;
}

// ---------- fetch auxiliares ----------
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

// alunos ativos/matriculados
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

// tarefas por sala
async function fetchTasksByRoom() {
  const res = await fetch(`${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tasks = await res.json();
  return Array.isArray(tasks) ? tasks : [];
}

// desempenho geral da sala (todas tarefas) via endpoint existente
async function fetchRoomPerformance() {
  const res = await fetch(
    `${API_URL}/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// redações de uma tarefa (com studentName/email)
async function fetchEssaysByTask(taskId) {
  const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/with-student`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

// ---------- UI: painel inline por aluno ----------
function closeAllInlinePanels() {
  if (!studentsList) return;
  const panels = studentsList.querySelectorAll('.mk-inline-panel');
  panels.forEach((p) => (p.style.display = 'none'));
}

function buildInlinePanel() {
  const wrap = document.createElement('div');
  wrap.className = 'mk-inline-panel';

  const head = document.createElement('div');
  head.className = 'mk-inline-head';

  const title = document.createElement('strong');
  title.textContent = 'Desempenho individual';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Fechar desempenho';
  closeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    wrap.style.display = 'none';
  });

  head.appendChild(title);
  head.appendChild(closeBtn);

  const avgsUl = document.createElement('ul');
  avgsUl.className = 'lista';
  avgsUl.id = 'mkInlineAvgs';

  const h4 = document.createElement('h4');
  h4.textContent = 'Redação/feedback';
  h4.style.marginTop = '10px';

  const essaysUl = document.createElement('ul');
  essaysUl.className = 'lista';
  essaysUl.id = 'mkInlineEssays';

  wrap.appendChild(head);
  wrap.appendChild(avgsUl);
  wrap.appendChild(h4);
  wrap.appendChild(essaysUl);

  return wrap;
}

function fillInlinePanel(panel, studentGroup, medias, taskIdForLink) {
  if (!panel) return;

  const avgsUl = panel.querySelector('#mkInlineAvgs');
  if (avgsUl) {
    avgsUl.innerHTML = `
      <li>Média total: <strong>${medias.mTotal ?? '—'}</strong></li>
      <li>C1 — Domínio da norma culta: <strong>${medias.mC1 ?? '—'}</strong></li>
      <li>C2 — Compreensão do tema e repertório: <strong>${medias.mC2 ?? '—'}</strong></li>
      <li>C3 — Argumentação e projeto de texto: <strong>${medias.mC3 ?? '—'}</strong></li>
      <li>C4 — Coesão e mecanismos linguísticos: <strong>${medias.mC4 ?? '—'}</strong></li>
      <li>C5 — Proposta de intervenção: <strong>${medias.mC5 ?? '—'}</strong></li>
    `;
  }

  const essaysUl = panel.querySelector('#mkInlineEssays');
  if (!essaysUl) return;

  essaysUl.innerHTML = '';

  // aqui, por tarefa, normalmente há só 1 redação; mas deixamos flexível
  const essays = [...(studentGroup.essays || [])];
  essays.forEach((e) => {
    const li = document.createElement('li');

    const nota = document.createElement('div');
    nota.textContent = isCorrected(e)
      ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${e.c4 ?? '—'} C5 ${e.c5 ?? '—'})`
      : 'Sem correção (pendente)';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação/feedback';
    btn.addEventListener('click', () => {
      // modo novo do feedback-professor: taskId + studentId
      window.location.href =
        `feedback-professor.html?taskId=${encodeURIComponent(String(taskIdForLink))}` +
        `&studentId=${encodeURIComponent(String(studentGroup.studentId))}`;
    });

    li.appendChild(nota);
    li.appendChild(document.createElement('br'));
    li.appendChild(btn);

    essaysUl.appendChild(li);
  });
}

// ---------- cálculo e render: médias da sala ----------
async function carregarMediasDaSala() {
  // mantém seu conceito: média geral de todas as redações corrigidas (todas tarefas)
  const activeSet = await getActiveStudentsSet();

  const dataAll = await fetchRoomPerformance();
  let data = dataAll;

  // filtra removidos
  if (activeSet && activeSet.size > 0) {
    data = data.filter((e) => activeSet.has(String(e.studentId)));
  }

  const corrected = data.filter((e) => isCorrected(e));

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

  // donut sala (centro: média total)
  renderLegend(roomDonutLegendEl);
  renderDonut(
    roomDonutEl,
    { c1: mC1 || 0, c2: mC2 || 0, c3: mC3 || 0, c4: mC4 || 0, c5: mC5 || 0 },
    mTotal !== null ? `Média ${mTotal}` : '—'
  );
}

// ---------- tarefas + alunos por tarefa ----------
let tasksCache = [];
let selectedTaskId = null;

function renderTasksBar(tasks) {
  if (!tasksBar) return;
  tasksBar.innerHTML = '';

  if (!Array.isArray(tasks) || tasks.length === 0) {
    tasksBar.innerHTML = '<span class="mk-muted">Nenhuma tarefa criada.</span>';
    return;
  }

  tasks.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mk-taskbtn';
    btn.textContent = t?.title || 'Tarefa';
    btn.setAttribute('aria-pressed', String(String(t?.id) === String(selectedTaskId)));

    btn.addEventListener('click', async () => {
      selectedTaskId = String(t.id);
      renderTasksBar(tasksCache);
      await carregarAlunosDaTarefa(selectedTaskId);
    });

    tasksBar.appendChild(btn);
  });
}

function groupByStudent(essays) {
  const byStudent = new Map();

  (Array.isArray(essays) ? essays : []).forEach((e) => {
    const sid = e?.studentId;
    if (!sid) return;

    if (!byStudent.has(sid)) {
      byStudent.set(sid, {
        studentId: sid,
        studentName: e.studentName || '',
        studentEmail: e.studentEmail || '',
        essays: [],
      });
    }

    const g = byStudent.get(sid);
    if (!g.studentName && e.studentName) g.studentName = e.studentName;
    if (!g.studentEmail && e.studentEmail) g.studentEmail = e.studentEmail;

    g.essays.push(e);
  });

  return Array.from(byStudent.values());
}

function calcStudentMedias(studentGroup) {
  const corrected = (studentGroup.essays || []).filter((e) => isCorrected(e));

  return {
    mTotal: mean(corrected.map((e) => e.score)),
    mC1: mean(corrected.map((e) => e.c1)),
    mC2: mean(corrected.map((e) => e.c2)),
    mC3: mean(corrected.map((e) => e.c3)),
    mC4: mean(corrected.map((e) => e.c4)),
    mC5: mean(corrected.map((e) => e.c5)),
    correctedCount: corrected.length,
    totalCount: (studentGroup.essays || []).length,
  };
}

async function carregarAlunosDaTarefa(taskId) {
  try {
    if (!studentsList) return;

    setStatus('Carregando alunos da tarefa...');
    studentsList.innerHTML = '<li>Carregando...</li>';

    const activeSet = await getActiveStudentsSet();

    let essays = await fetchEssaysByTask(taskId);

    // filtra removidos
    if (activeSet && activeSet.size > 0) {
      essays = essays.filter((e) => activeSet.has(String(e.studentId)));
    }

    if (!Array.isArray(essays) || essays.length === 0) {
      studentsList.innerHTML = '<li>Nenhum aluno enviou redação nesta tarefa (ou foram removidos).</li>';
      if (taskInfo) taskInfo.textContent = '';
      setStatus('');
      return;
    }

    const groups = groupByStudent(essays);

    // ordena por nome
    groups.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

    // info da tarefa
    const taskObj = tasksCache.find((t) => String(t.id) === String(taskId));
    if (taskInfo) {
      const title = taskObj?.title ? String(taskObj.title) : 'Tarefa';
      taskInfo.textContent = `${title} — ${groups.length} aluno(s) com envio`;
    }

    studentsList.innerHTML = '';

    groups.forEach((g) => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.marginBottom = '12px';

      const card = document.createElement('div');
      card.className = 'mk-student';

      const top = document.createElement('div');
      top.className = 'mk-student-top';

      // esquerda: avatar + nome/email
      const idBox = document.createElement('div');
      idBox.className = 'mk-student-id';

      const avatar = makeAvatar(g.studentId, 42);

      const nameBox = document.createElement('div');
      nameBox.className = 'mk-student-name';

      const nome =
        g.studentName && String(g.studentName).trim() ? String(g.studentName).trim() : 'Aluno';
      const email =
        g.studentEmail && String(g.studentEmail).trim() ? String(g.studentEmail).trim() : '';

      nameBox.innerHTML = `<strong>${nome}</strong>${email ? `<small>${email}</small>` : `<small>&nbsp;</small>`}`;

      idBox.appendChild(avatar);
      idBox.appendChild(nameBox);

      // direita: donut (na “parte em branco” ao lado)
      const donutWrap = document.createElement('div');
      donutWrap.className = 'mk-donut-wrap';

      const medias = calcStudentMedias(g);

      const center =
        medias.mTotal !== null
          ? String(medias.mTotal)
          : '—';

      renderDonut(
        donutWrap,
        {
          c1: medias.mC1 || 0,
          c2: medias.mC2 || 0,
          c3: medias.mC3 || 0,
          c4: medias.mC4 || 0,
          c5: medias.mC5 || 0,
        },
        center
      );

      top.appendChild(idBox);
      top.appendChild(donutWrap);

      // resumo + botão
      const resumo = document.createElement('div');
      resumo.style.marginTop = '10px';
      resumo.textContent =
        `Média: ${medias.mTotal ?? '—'} | ` +
        `C1 ${medias.mC1 ?? '—'} C2 ${medias.mC2 ?? '—'} C3 ${medias.mC3 ?? '—'} C4 ${medias.mC4 ?? '—'} C5 ${medias.mC5 ?? '—'}`;

      const actions = document.createElement('div');
      actions.className = 'mk-student-actions';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Ver desempenho individual';

      const inlinePanel = buildInlinePanel();

      const toggleInline = () => {
        const isOpen = inlinePanel.style.display === 'block';
        closeAllInlinePanels();

        if (!isOpen) {
          fillInlinePanel(inlinePanel, g, medias, taskId);
          inlinePanel.style.display = 'block';
          // scroll suave para o painel (fica logo ali, mas ajuda no mobile)
          inlinePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      };

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleInline();
      });

      // clicar no card também abre/fecha
      card.style.cursor = 'pointer';
      card.title = 'Clique para ver/ocultar o desempenho individual';
      card.addEventListener('click', (ev) => {
        if (ev.target && ev.target.tagName === 'BUTTON') return;
        toggleInline();
      });

      actions.appendChild(btn);

      card.appendChild(top);
      card.appendChild(resumo);
      card.appendChild(actions);
      card.appendChild(inlinePanel);

      li.appendChild(card);
      studentsList.appendChild(li);
    });

    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar alunos da tarefa.');
    if (studentsList) studentsList.innerHTML = '<li>Erro ao carregar.</li>';
  }
}

// ---------- init ----------
async function init() {
  try {
    setStatus('Carregando...');

    await carregarSala();

    // médias gerais (todas tarefas)
    await carregarMediasDaSala();

    // tarefas
    tasksCache = await fetchTasksByRoom();

    // seleciona 1ª tarefa (se existir)
    if (tasksCache.length > 0) {
      selectedTaskId = String(tasksCache[0].id);
    } else {
      selectedTaskId = null;
    }

    renderTasksBar(tasksCache);

    // carrega alunos da tarefa selecionada
    if (selectedTaskId) {
      await carregarAlunosDaTarefa(selectedTaskId);
    } else {
      if (studentsList) studentsList.innerHTML = '<li>Nenhuma tarefa criada ainda.</li>';
      if (taskInfo) taskInfo.textContent = '';
    }

    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('Erro ao inicializar a página.');
  }
}

init();
