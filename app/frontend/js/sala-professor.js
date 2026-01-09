import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-professor.html';
}

const roomNameEl = document.getElementById('roomName');
const roomCodeEl = document.getElementById('roomCode');
const studentsList = document.getElementById('studentsList');
const tasksList = document.getElementById('tasksList');


async function carregarSala() {
  const response = await fetch(`${API_URL}/rooms/${roomId}`);
  const room = await response.json();

  roomNameEl.textContent = room.name;
  roomCodeEl.textContent = room.code;
}


document.getElementById('copyCodeBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCodeEl.textContent);
  alert('Código da sala copiado!');
});


async function carregarAlunos() {
  const response = await fetch(`${API_URL}/rooms/${roomId}/students`);
  const students = await response.json();

  studentsList.innerHTML = '';

  students.forEach(student => {
    const li = document.createElement('li');
    li.textContent = `${student.name} (${student.email})`;
    studentsList.appendChild(li);
  });
}


async function carregarTarefas() {
  const response = await fetch(`${API_URL}/tasks/by-room?roomId=${roomId}`);
  const tasks = await response.json();

  tasksList.innerHTML = '';

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.textContent = task.title;

    const btn = document.createElement('button');
    btn.textContent = 'Ver redações';
    btn.onclick = () => {
      window.location.href = `correcao/index.html?taskId=${task.id}`;
    };

    li.appendChild(btn);
    tasksList.appendChild(li);
  });
}


document.getElementById('createTaskBtn').addEventListener('click', async () => {
  const title = document.getElementById('taskTitle').value;
  const guidelines = document.getElementById('taskGuidelines').value;

  if (!title) {
    alert('Informe o tema da redação.');
    return;
  }

  await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, title, guidelines })
  });

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskGuidelines').value = '';

  carregarTarefas();
});

// 🔹 Inicialização
carregarSala();
carregarAlunos();
carregarTarefas();
