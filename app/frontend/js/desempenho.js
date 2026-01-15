import { API_URL } from './config.js';

const statusEl = document.getElementById('status');
const roomSelect = document.getElementById('roomSelect');
const profOnly = document.getElementById('profOnly');
const studentSelect = document.getElementById('studentSelect');
const chartEl = document.getElementById('chart');
const historyList = document.getElementById('historyList');

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function getSession() {
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');

  if (professorId) return { role: 'professor', id: professorId };
  if (studentId) return { role: 'student', id: studentId };
  return null;
}

const session = getSession();
if (!session) {
  window.location.href = 'login.html';
}

// ===== helpers =====
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

// barras simples (sem libs)
function renderChart(data) {
  chartEl.innerHTML = '';

  if (!data || data.length === 0) {
    chartEl.textContent = 'Sem dados para exibir.';
    return;
  }

  // pega máximos
  const maxTotal = 1000;

  // container
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.gap = '10px';

  data.forEach((item, idx) => {
    const total = Number(item.total ?? item.score ?? 0);
    const label = document.createElement('div');
    label.textContent = `Redação ${idx + 1} — Total: ${total}`;

    const barWrap = document.createElement('div');
    barWrap.style.border = '1px solid #ccc';
    barWrap.style.borderRadius = '10px';
    barWrap.style.overflow = 'hidden';
    barWrap.style.height = '14px';
    barWrap.style.background = '#f5f5f5';

    const bar = document.createElement('div');
    bar.style.height = '100%';
    bar.style.width = `${Math.max(0, Math.min(100, (total / maxTotal) * 100))}%`;
    bar.style.background = '#222';

    barWrap.appendChild(bar);

    // detalhamento ENEM (c1..c5)
    const det = document.createElement('div');
    const c1 = item.c1 ?? 0, c2 = item.c2 ?? 0, c3 = item.c3 ?? 0, c4 = item.c4 ?? 0, c5 = item.c5 ?? 0;
    det.textContent = `C1:${c1}  C2:${c2}  C3:${c3}  C4:${c4}  C5:${c5}`;

    const box = document.createElement('div');
    box.appendChild(label);
    box.appendChild(barWrap);
    box.appendChild(det);

    wrap.appendChild(box);
  });

  chartEl.appendChild(wrap);
}

function renderHistory(list) {
  historyList.innerHTML = '';

  if (!list || list.length === 0) {
    historyList.innerHTML = '<li>Nenhuma redação corrigida/enviada nesta sala.</li>';
    return;
  }

  list.forEach((e, idx) => {
    const li = document.createElement('li');

    const title = document.createElement('div');
    const total = Number(e.total ?? e.score ?? 0);
    title.innerHTML = `<strong>Redação ${idx + 1}</strong> — Total: ${total}`;

    const meta = document.createElement('div');
    const name = e.studentName ? `Aluno: ${e.studentName}` : '';
    meta.textContent = name;

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação';
    btn.onclick = () => {
      // abre visualização simples via querystring
      window.location.href = `ver-redacao.html?essayId=${e.id}`;
    };

    li.appendChild(title);
    if (name) li.appendChild(meta);
    li.appendChild(btn);
    historyList.appendChild(li);
  });
}

// ===== carregar salas =====
async function carregarSalas() {
  setStatus('Carregando salas...');

  try {
    let res;

    if (session.role === 'professor') {
      res = await fetch(`${API_URL}/rooms/by-professor?professorId=${session.id}`);
    } else {
      res = await fetch(`${API_URL}/enrollments/by-student?studentId=${session.id}`);
    }

    if (!res.ok) throw new Error();

    const rooms = await res.json();

    roomSelect.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      roomSelect.innerHTML = '<option value="">(nenhuma sala)</option>';
      setStatus('Você não tem salas para analisar.');
      return;
    }

    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      roomSelect.appendChild(opt);
    });

    setStatus('');
    await onRoomChange(); // carrega dados iniciais

  } catch {
    setStatus('Erro ao carregar salas.');
  }
}

async function carregarAlunosDaSala(roomId) {
  // só professor
  profOnly.style.display = 'block';

  studentSelect.innerHTML = `<option value="">(todos)</option>`;

  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}/students`);
    if (!res.ok) throw new Error();

    const students = await res.json();
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; // precisa vir do backend
      opt.textContent = `${s.name} (${s.email})`;
      studentSelect.appendChild(opt);
    });

  } catch {
    // sem travar
  }
}

async function carregarDesempenho(roomId, studentIdFilter = '') {
  setStatus('Carregando desempenho...');

  try {
    let url = `${API_URL}/analytics/room/${roomId}/essays`;

    // aluno sempre filtra por si
    if (session.role === 'student') {
      url += `?studentId=${encodeURIComponent(session.id)}`;
    } else if (studentIdFilter) {
      url += `?studentId=${encodeURIComponent(studentIdFilter)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error();

    const data = await res.json();

    // data: lista de redações com c1..c5 e total/score e id e (opcional) studentName
    renderChart(data);
    renderHistory(data);

    setStatus('');

  } catch {
    setStatus('Erro ao carregar desempenho.');
    renderChart([]);
    renderHistory([]);
  }
}

// ===== eventos =====
async function onRoomChange() {
  const roomId = roomSelect.value;
  if (!roomId) return;

  if (session.role === 'professor') {
    await carregarAlunosDaSala(roomId);
    await carregarDesempenho(roomId, studentSelect.value);
  } else {
    profOnly.style.display = 'none';
    await carregarDesempenho(roomId, '');
  }
}

roomSelect.addEventListener('change', onRoomChange);
studentSelect.addEventListener('change', () => {
  const roomId = roomSelect.value;
  if (!roomId) return;
  carregarDesempenho(roomId, studentSelect.value);
});

// init
carregarSalas();
