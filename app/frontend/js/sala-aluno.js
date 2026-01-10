import { API_URL } from './config.js';


const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');
const status = document.getElementById('status');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-aluno.html';
  throw new Error('roomId ausente');
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
    const response = await fetch(
      `${API_URL}/tasks/by-room?roomId=${roomId}`
    );

    if (!response.ok) throw new Error();

    const tasks = await response.json();
    tasksList.innerHTML = '';

    if (tasks.length === 0) {
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


carregarSala();
carregarTarefas();
