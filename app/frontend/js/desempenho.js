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

  const max = 1000;

  essays.forEach((e, idx) => {
    const score = safeScore(e.score);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.margin = '8px 0';

    // ✅ clicar na linha abre a redação
    row.style.cursor = 'pointer';
    row.title = 'Clique para ver a redação';
    row.addEventListener('click', () => {
      window.location.href = `ver-redacao.html?essayId=${encodeURIComponent(e.id)}`;
    });

    const label = document.createElement('div');
    label.style.width = '120px';
    label.style.fontSize = '12px';
    label.style.opacity = '0.85';
    label.textContent = makeLabelFromTaskId(e.taskId, idx);

    const barWrap = document.createElement('div');
    barWrap.style.flex = '1';
    barWrap.style.height = '12px';
    barWrap.style.border = '1px solid #ddd';
    barWrap.style.borderRadius = '6px';
    barWrap.style.overflow = 'hidden';

    const bar = document.createElement('div');
    const pct =
      score === null ? 0 : Math.max(0, Math.min(100, Math.round((score / max) * 100)));
    bar.style.height = '100%';
    bar.style.width = `${pct}%`;
    // deixa a cor por CSS se quiser; se não tiver CSS, ainda aparece a barra com largura
    bar.className = 'bar';

    // fallback simples caso você não tenha .bar no CSS
    if (!bar.style.background) bar.style.background = '#888';

    barWrap.appendChild(bar);

    const val = document.createElement('div');
    val.style.width = '70px';
    val.style.textAlign = 'right';
    val.style.fontSize = '12px';
    val.textContent = score === null ? '—' : String(score);

    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(val);

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
