import { API_URL } from './config.js';

// 🔹 Parâmetros
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-professor.html';
  throw new Error('roomId ausente');
}

// 🔹 Elementos do DOM (com proteção)
const roomNameEl = document.getElementById('roomName');
const roomCodeEl = document.getElementById('roomCode');
const studentsList = document.getElementById('studentsList');
const tasksList = document.getElementById('tasksList');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const createTaskBtn = document.getElementById('createTaskBtn');

if (!roomNameEl || !roomCodeEl || !studentsList || !tasksList || !copyCodeBtn || !createTaskBtn) {
  console.error('Elementos da sala do professor não encontrados.');
  throw new Error('HTML incompleto');
}

// 🔹 Carregar dados da sala
async function carregarSala() {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`);
    if (!response.ok) throw new Error();

    const room = await response.json();
    roomNameEl.textContent = room.name;
    roomCodeEl.textContent = room.code || '—';

  } catch {
    alert('Erro ao carregar dados da sala.');
  }
}

// 🔹 Copiar código da sala
copyCodeBtn.addEventListener('click', () => {
  if (!roomCodeEl.textContent || roomCodeEl.textContent === '—') {
    alert('Código da sala indisponível.');
    return;
  }

  navigator.clipboard.writeText(roomCodeEl.textContent);
  alert('Código da sala copiado!');
});

// 🔹 Carregar alunos
async function carregarAlunos() {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/students`);
    if (!response.ok) throw new Error();

    const students = await response.json();
    studentsList.innerHTML = '';

    if (students.length === 0) {
      studentsList.innerHTML = '<li>Nenhum aluno cadastrado.</li>';
      return;
    }

    students.forEach(student => {
      const li = document.createElement('li');
      li.textContent = `${student.name} (${student.email})`;
      studentsList.appendChild(li);
    });

  } catch {
    studentsList.innerHTML = '<li>Erro ao carregar alunos.</li>';
  }
}

// 🔹 Carregar tarefas
async function carregarTarefas() {
  try {
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${roomId}`);
    if (!response.ok) throw new Error();

    const tasks = await response.json();
    tasksList.innerHTML = '';

    if (tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa criada.</li>';
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.textContent = task.title;

      const btn = document.createElement('button');
      btn.textContent = 'Ver redações';
      btn.onclick = () => {
  window.location.href = `correcao.html?taskId=${task.id}`;
};

      li.appendChild(btn);
      tasksList.appendChild(li);
    });

  } catch {
    tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// 🔹 Criar nova tarefa
createTaskBtn.addEventListener('click', async () => {
  const title = document.getElementById('taskTitle').value.trim();
  const guidelines = document.getElementById('taskGuidelines').value.trim();

  if (!title) {
    alert('Informe o tema da redação.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, title, guidelines }),
    });

    if (!response.ok) throw new Error();

    document.getElementById('taskTitle').value = '';
    document.getElementById('taskGuidelines').value = '';

    carregarTarefas();

  } catch {
    alert('Erro ao criar tarefa.');
  }
});

// 🔹 Inicialização
carregarSala();
carregarAlunos();
carregarTarefas();
