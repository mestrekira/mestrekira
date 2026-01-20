import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const studentId = localStorage.getItem('studentId');

const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');
const status = document.getElementById('status');

const leaveBtn = document.getElementById('leaveRoomBtn');
const leaveStatus = document.getElementById('leaveStatus');

// ✅ novos elementos (se não existirem, não quebra)
const professorInfoEl = document.getElementById('professorInfo');
const classmatesListEl = document.getElementById('classmatesList');

if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente');
}

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-aluno.html';
  throw new Error('roomId ausente');
}

// ✅ SAIR DA SALA
if (leaveBtn) {
  leaveBtn.addEventListener('click', async () => {
    const ok = confirm('Tem certeza que deseja sair desta sala?');
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/enrollments/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, studentId }),
      });

      if (!res.ok) throw new Error();

      if (leaveStatus) leaveStatus.textContent = 'Você saiu da sala.';
      setTimeout(() => {
        window.location.href = 'painel-aluno.html';
      }, 600);
    } catch {
      if (leaveStatus) leaveStatus.textContent = 'Erro ao sair da sala.';
      else alert('Erro ao sair da sala.');
    }
  });
}

async function carregarSala() {
  try {
    const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) throw new Error();

    const room = await response.json();
    if (roomNameEl) roomNameEl.textContent = room.name || 'Sala';
  } catch {
    if (roomNameEl) roomNameEl.textContent = 'Erro ao carregar sala';
  }
}

// ✅ NOVO: professor + colegas
async function carregarOverview() {
  // se a página não tem esses elementos, não precisa fazer nada
  if (!professorInfoEl && !classmatesListEl) return;

  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/overview`);
    if (!res.ok) throw new Error();

    const data = await res.json();

    // professor
    if (professorInfoEl) {
      if (data?.professor?.name) {
        const emailTxt = data.professor.email ? ` (${data.professor.email})` : '';
        professorInfoEl.textContent = `${data.professor.name}${emailTxt}`;
      } else {
        professorInfoEl.textContent = 'Professor não encontrado.';
      }
    }

    // colegas
    if (classmatesListEl) {
      classmatesListEl.innerHTML = '';

      const students = Array.isArray(data?.students) ? data.students : [];

      // remove eu mesmo da lista
      const classmates = students.filter((s) => s?.id && s.id !== studentId);

      if (classmates.length === 0) {
        classmatesListEl.innerHTML = '<li>Nenhum colega matriculado ainda.</li>';
        return;
      }

      classmates.forEach((s) => {
        const li = document.createElement('li');
        const emailTxt = s.email ? ` (${s.email})` : '';
        li.textContent = `${s.name || 'Aluno'}${emailTxt}`;
        classmatesListEl.appendChild(li);
      });
    }
  } catch {
    // fallback amigável
    if (professorInfoEl) professorInfoEl.textContent = 'Não foi possível carregar o professor agora.';
    if (classmatesListEl) classmatesListEl.innerHTML = '<li>Não foi possível carregar colegas agora.</li>';
  }
}

async function carregarTarefas() {
  if (!tasksList) return;

  try {
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`);
    if (!response.ok) throw new Error();

    const tasks = await response.json();
    tasksList.innerHTML = '';

    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      if (status) status.textContent = '';
      return;
    }

    tasks.forEach((task) => {
      const li = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = task.title || 'Tarefa';

      const btn = document.createElement('button');
      btn.textContent = 'Escrever redação';
      btn.onclick = () => {
        window.location.href = `redacao.html?taskId=${task.id}`;
      };

      li.appendChild(title);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);

      tasksList.appendChild(li);
    });

    if (status) status.textContent = '';
  } catch {
    if (status) status.textContent = 'Erro ao carregar tarefas.';
    tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

carregarSala();
carregarOverview();
carregarTarefas();
