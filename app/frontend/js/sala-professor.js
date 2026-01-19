import { API_URL } from './config.js';

// 🔹 Parâmetros
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'professor-salas.html';
  throw new Error('roomId ausente');
}

// 🔹 Elementos
const roomNameEl = document.getElementById('roomName');
const roomCodeEl = document.getElementById('roomCode');
const studentsList = document.getElementById('studentsList');
const tasksList = document.getElementById('tasksList');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const createTaskBtn = document.getElementById('createTaskBtn');
const performanceBtn = document.getElementById('performanceBtn');

if (!roomNameEl || !roomCodeEl || !studentsList || !tasksList || !copyCodeBtn || !createTaskBtn) {
  console.error('Elementos da sala do professor não encontrados.');
  throw new Error('HTML incompleto');
}

// ✅ BOTÃO DE DESEMPENHO (FICA FORA do createTask)
if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho-professor.html?roomId=${roomId}`;
  });
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

// 🔹 Copiar código
copyCodeBtn.addEventListener('click', () => {
  const code = roomCodeEl.textContent?.trim();
  if (!code || code === '—') {
    alert('Código da sala indisponível.');
    return;
  }

  navigator.clipboard.writeText(code);
  alert('Código da sala copiado!');
});

// ✅ Remover aluno da sala
async function removerAluno(studentId, studentName = 'este aluno') {
  const ok = confirm(`Remover ${studentName} da sala?`);
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}/students/${studentId}`, {
      method: 'DELETE',
    });

    if (!res.ok) throw new Error();

    await carregarAlunos();
  } catch {
    alert('Erro ao remover aluno da sala.');
  }
}

// 🔹 Carregar alunos
async function carregarAlunos() {
  studentsList.innerHTML = '<li>Carregando alunos...</li>';

  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/students`);
    if (!response.ok) throw new Error();

    const students = await response.json();
    studentsList.innerHTML = '';

    if (!Array.isArray(students) || students.length === 0) {
      studentsList.innerHTML = '<li>Nenhum aluno matriculado ainda.</li>';
      return;
    }

    students.forEach(student => {
      const li = document.createElement('li');

      const label = document.createElement('span');
      const name = student.name?.trim() || 'Aluno';
      const email = student.email?.trim() || '';
      label.textContent = email ? `${name} (${email})` : name;

      li.appendChild(label);

      // ✅ Botão remover (só se tiver id)
      if (student.id) {
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => removerAluno(student.id, name));
        li.appendChild(document.createTextNode(' '));
        li.appendChild(removeBtn);
      }

      studentsList.appendChild(li);
    });
  } catch {
    studentsList.innerHTML = '<li>Não foi possível carregar alunos agora.</li>';
  }
}

// 🔹 Carregar tarefas
async function carregarTarefas() {
  tasksList.innerHTML = '<li>Carregando tarefas...</li>';

  try {
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${roomId}`);
    if (!response.ok) throw new Error();

    const tasks = await response.json();
    tasksList.innerHTML = '';

    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa criada.</li>';
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = task.title;

      const btn = document.createElement('button');
      btn.textContent = 'Ver redações';
      btn.onclick =
