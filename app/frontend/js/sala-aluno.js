import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const studentId = localStorage.getItem('studentId');

if (!studentId) {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente');
}

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-aluno.html';
  throw new Error('roomId ausente');
}

// ELEMENTOS
const roomNameEl = document.getElementById('roomName');
const teacherInfoEl = document.getElementById('teacherInfo');
const classmatesList = document.getElementById('classmatesList');

const tasksList = document.getElementById('tasksList');
const status = document.getElementById('status');

const leaveBtn = document.getElementById('leaveRoomBtn');
const leaveStatus = document.getElementById('leaveStatus');

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

// ✅ CARREGAR OVERVIEW: sala + professor + colegas
async function carregarOverview() {
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}/overview`);
    if (!res.ok) throw new Error();

    const data = await res.json();

    // Sala
    roomNameEl.textContent = data?.room?.name || 'Sala';

    // Professor
    if (data.professor) {
      teacherInfoEl.textContent = `${data.professor.name} (${data.professor.email})`;
    } else {
      teacherInfoEl.textContent = 'Professor não encontrado.';
    }

    // Colegas
    classmatesList.innerHTML = '';

    const students = Array.isArray(data.students) ? data.students : [];
    if (students.length === 0) {
      classmatesList.innerHTML = '<li>Nenhum colega matriculado ainda.</li>';
      return;
    }

    students.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name} (${s.email})`;
      classmatesList.appendChild(li);
    });

  } catch {
    teacherInfoEl.textContent = 'Erro ao carregar dados da sala.';
    classmatesList.innerHTML = '<li>Erro ao carregar colegas.</li>';
  }
}

// ✅ CARREGAR TAREFAS
async function carregarTarefas() {
  try {
    status.textContent = '';
    tasksList.innerHTML = '';

    const res = await fetch(`${API_URL}/tasks/by-room?roomId=${roomId}`);
    if (!res.ok) throw new Error();

    const tasks = await res.json();

    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = task.title;

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

  } catch {
    status.textContent = 'Erro ao carregar tarefas.';
  }
}

// INIT
carregarOverview();
carregarTarefas();
