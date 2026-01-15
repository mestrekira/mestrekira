import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

// 🔹 ID DO ALUNO
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

// 🔹 ELEMENTOS
const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');
const status = document.getElementById('status');

const leaveBtn = document.getElementById('leaveRoomBtn');
const leaveStatus = document.getElementById('leaveStatus');

// ✅ SAIR DA SALA (fora das funções para evitar múltiplos listeners)
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
    const response = await fetch(`${API_URL}/rooms/${roomId}`);
    if (!response.ok) throw new Error();

    const room = await response.json();
    roomNameEl.textContent = room.name;

  } catch {
    roomNameEl.textContent = 'Erro ao carregar sala';
  }
}

async function carregarTarefas() {
  try {
    status.textContent = '';
    tasksList.innerHTML = '';

    // ✅ por enquanto mantém simples
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${roomId}`);
    if (!response.ok) throw new Error();

    const tasks = await response.json();

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

// 🔹 INIT
carregarSala();
carregarTarefas();
