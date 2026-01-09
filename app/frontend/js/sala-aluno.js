import { API_URL } from './config.js';

const studentId = localStorage.getItem('studentId');
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!studentId || !roomId) {
  alert('Acesso inválido.');
  window.location.href = 'login-aluno.html';
}

const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');

// 🔹 Dados da sala
async function carregarSala() {
  const response = await fetch(`${API_URL}/rooms/${roomId}`);
  const room = await response.json();
  roomNameEl.textContent = room.name;
}

// 🔹 Tarefas do aluno
async function carregarTarefas() {
  const response = await fetch(
    `${API_URL}/tasks/by-room-student?roomId=${roomId}&studentId=${studentId}`
  );
  const tasks = await response.json();

  tasksList.innerHTML = '';

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.textContent = task.title;

    const status = document.createElement('span');
    status.textContent = ` — ${task.status}`;

    const btn = document.createElement('button');

    if (task.status === 'corrigida') {
      btn.textContent = 'Ver feedback';
      btn.onclick = () => {
        window.location.href = `feedback.html?essayId=${task.essayId}`;
      };
    } else {
      btn.textContent = 'Escrever redação';
      btn.onclick = () => {
        window.location.href =
          `tarefa.html?taskId=${task.id}&roomId=${roomId}`;
      };
    }

    li.appendChild(status);
    li.appendChild(btn);
    tasksList.appendChild(li);
  });
}

carregarSala();
carregarTarefas();
