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

// ✅ Botão de desempenho
if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho-professor.html?roomId=${encodeURIComponent(roomId)}`;
  });
}

// =======================
// Helpers
// =======================

function normalizeStudent(s) {
  // aceita variações do backend
  const id = String(s?.id || s?.studentId || '').trim();
  const name = String(s?.name || s?.studentName || '').trim();
  const email = String(s?.email || s?.studentEmail || '').trim();
  return { id, name, email };
}

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v) return v;
  }
  return null;
}

function normalizeTask(t) {
  const id = String(t?.id || t?.taskId || '').trim();
  const title = String(t?.title || t?.taskTitle || t?.name || '').trim();
  const guidelines = String(t?.guidelines || ''); // 👈 não trim: preserva quebras
  const createdAt = pickDate(t, ['createdAt', 'created_at', 'created', 'dateCreated', 'timestamp']);
  return { id, title, guidelines, createdAt, _raw: t };
}

function formatDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function getLastCreatedTaskKey() {
  return `mk_last_created_task_${roomId}`;
}

function setLastCreatedTaskId(taskId) {
  try {
    localStorage.setItem(getLastCreatedTaskKey(), String(taskId || ''));
  } catch {
    // ignora
  }
}

function getLastCreatedTaskId() {
  try {
    const v = localStorage.getItem(getLastCreatedTaskKey());
    return v ? String(v) : '';
  } catch {
    return '';
  }
}

function placeholderAvatar() {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">?</text>
      </svg>`
    )
  );
}

// =======================
// Sala
// =======================

async function carregarSala() {
  try {
    const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const room = await response.json();
    roomNameEl.textContent = room?.name || 'Sala';
    roomCodeEl.textContent = room?.code || '—';
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar dados da sala.');
  }
}

// 🔹 Copiar código
copyCodeBtn.addEventListener('click', () => {
  const code = (roomCodeEl.textContent || '').trim();
  if (!code || code === '—') {
    alert('Código da sala indisponível.');
    return;
  }
  navigator.clipboard.writeText(code);
  alert('Código da sala copiado!');
});

// =======================
// Alunos
// =======================

async function removerAluno(studentId, studentName = 'este aluno') {
  const ok = confirm(`Remover ${studentName} da sala?`);
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/students/${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await carregarAlunos();
  } catch (err) {
    console.error(err);
    alert('Erro ao remover aluno da sala.');
  }
}

async function carregarAlunos() {
  studentsList.innerHTML = '<li>Carregando alunos...</li>';

  const photoKey = (studentId) => `mk_photo_student_${studentId}`;

  try {
    const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/students`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.json();
    console.log('[students raw]', raw);

    const arr = Array.isArray(raw) ? raw : [];
    const students = arr.map(normalizeStudent).filter((s) => !!s.id);

    studentsList.innerHTML = '';

    if (students.length === 0) {
      studentsList.innerHTML = '<li>Nenhum aluno matriculado ainda.</li>';
      return;
    }

    students.sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (!an && bn) return 1;
      if (an && !bn) return -1;
      return an.localeCompare(bn);
    });

    students.forEach((student) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '10px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';

      // foto
      const img = document.createElement('img');
      img.alt = 'Foto do aluno';
      img.width = 36;
      img.height = 36;
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.border = '1px solid #ccc';

      const dataUrl = localStorage.getItem(photoKey(student.id));
      img.src = dataUrl || placeholderAvatar();

      // texto
      const text = document.createElement('div');
      const name = student.name || 'Aluno';
      const email = student.email || '';
      text.innerHTML = `<strong>${name}</strong>${email ? `<br><small>${email}</small>` : ''}`;

      left.appendChild(img);
      left.appendChild(text);

      // botão remover
      const right = document.createElement('div');
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', () => removerAluno(student.id, name));
      right.appendChild(removeBtn);

      li.appendChild(left);
      li.appendChild(right);

      studentsList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    studentsList.innerHTML = '<li>Não foi possível carregar alunos agora.</li>';
  }
}

// =======================
// Tarefas
// =======================

function computeNewestTaskId(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  // 1) tenta por createdAt válido
  let newestId = null;
  let newestTime = -Infinity;

  tasks.forEach((t) => {
    const dt = t?.createdAt ? new Date(t.createdAt).getTime() : NaN;
    if (!Number.isNaN(dt)) {
      if (dt > newestTime) {
        newestTime = dt;
        newestId = t.id;
      }
    }
  });

  // 2) se ninguém tem data, assume que o backend devolve em ordem
  if (!newestId) newestId = tasks[tasks.length - 1].id;

  return newestId;
}

async function carregarTarefas() {
  tasksList.innerHTML = '<li>Carregando tarefas...</li>';

  try {
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.json();
    console.log('[tasks raw]', raw);

    const arr = Array.isArray(raw) ? raw : [];
    const tasks = arr.map(normalizeTask).filter((t) => !!t.id);

    tasksList.innerHTML = '';

    if (tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa criada.</li>';
      return;
    }

    // ✅ prioridade: se eu acabei de criar uma tarefa agora, destaca ela
    const lastCreatedId = getLastCreatedTaskId();
    const newestByDateId = computeNewestTaskId(tasks);
    const highlightId = lastCreatedId || newestByDateId;

    tasks.forEach((task) => {
      const li = document.createElement('li');

      // ✅ destaque da tarefa mais recente
      if (task.id === highlightId) {
        li.style.border = '2px solid rgba(109,40,217,.35)';
        li.style.boxShadow = '0 10px 24px rgba(109,40,217,0.12)';
      }

      const title = document.createElement('strong');
      title.textContent = task.title || 'Tarefa';

      // ✅ data de criação (se backend não mandar, fica “—”)
      const meta = document.createElement('div');
      meta.style.marginTop = '6px';
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.textContent = `Criada em: ${formatDateBR(task.createdAt)}`;

      const btn = document.createElement('button');
      btn.textContent = 'Ver redações';
      btn.addEventListener('click', () => {
        window.location.href = `correcao.html?taskId=${encodeURIComponent(task.id)}`;
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.addEventListener('click', async () => {
        const ok = confirm(`Excluir a tarefa "${task.title || 'sem título'}"?`);
        if (!ok) return;

        try {
          const res = await fetch(`${API_URL}/tasks/${encodeURIComponent(task.id)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // se apagou a destacada, limpa
          if (getLastCreatedTaskId() === task.id) setLastCreatedTaskId('');

          carregarTarefas();
        } catch (err) {
          console.error(err);
          alert('Erro ao excluir tarefa.');
        }
      });

      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);
      li.appendChild(delBtn);

      tasksList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// =======================
// Criar tarefa
// =======================

createTaskBtn.addEventListener('click', async () => {
  const titleEl = document.getElementById('taskTitle');
  const guidelinesEl = document.getElementById('taskGuidelines');

  const title = titleEl?.value?.trim() || '';
  const guidelines = guidelinesEl?.value || ''; // ✅ não trim: preserva linhas em branco

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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // tenta ler resposta (se backend devolver o objeto criado)
    const created = await response.json().catch(() => null);
    const newId = created?.id || created?.taskId || null;

    // ✅ guarda para destacar na lista
    if (newId) setLastCreatedTaskId(newId);

    if (titleEl) titleEl.value = '';
    if (guidelinesEl) guidelinesEl.value = '';

    carregarTarefas();
  } catch (err) {
    console.error(err);
    alert('Erro ao criar tarefa.');
  }
});

// =======================
// INIT
// =======================
carregarSala();
carregarAlunos();
carregarTarefas();
