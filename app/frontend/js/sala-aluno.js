import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const studentId = localStorage.getItem('studentId');

const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');
const status = document.getElementById('status');

const teacherInfo = document.getElementById('teacherInfo');
const classmatesList = document.getElementById('classmatesList');

const leaveBtn = document.getElementById('leaveRoomBtn');
const leaveStatus = document.getElementById('leaveStatus');

if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente');
}

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-aluno.html';
  throw new Error('roomId ausente');
}

// foto salva localmente (mesma lógica que você usa)
function photoKeyStudent(id) {
  return id ? `mk_photo_student_${id}` : null;
}
function photoKeyProfessor(id) {
  return id ? `mk_photo_professor_${id}` : null;
}

function makeAvatarFromLocalStorage(key, size = 34, alt = 'Foto') {
  const img = document.createElement('img');
  img.alt = alt;
  img.width = size;
  img.height = size;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.border = '1px solid #ccc';

  const dataUrl = key ? localStorage.getItem(key) : null;
  if (dataUrl) {
    img.src = dataUrl;
  } else {
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eee"/>
          <text x="50%" y="55%" font-size="${Math.round(size * 0.45)}" text-anchor="middle" fill="#888">?</text>
        </svg>`,
      );
  }
  return img;
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
      setTimeout(() => (window.location.href = 'painel-aluno.html'), 600);
    } catch {
      if (leaveStatus) leaveStatus.textContent = 'Erro ao sair da sala.';
      else alert('Erro ao sair da sala.');
    }
  });
}

// ✅ sala + professor + colegas
async function carregarOverview() {
  if (teacherInfo) teacherInfo.textContent = 'Carregando...';
  if (classmatesList) classmatesList.innerHTML = '<li>Carregando colegas...</li>';

  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/overview`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    // sala
    if (roomNameEl) roomNameEl.textContent = data?.room?.name || 'Sala';

    // professor
    if (teacherInfo) {
      const p = data?.professor;
      if (!p) {
        teacherInfo.textContent = 'Professor não identificado.';
      } else {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';

        const avatar = makeAvatarFromLocalStorage(
          photoKeyProfessor(p.id),
          38,
          'Foto do professor',
        );

        const text = document.createElement('div');
        const name = (p.name || 'Professor').trim();
        const email = (p.email || '').trim();
        text.innerHTML = `<strong>${name}</strong>${email ? `<br><small>${email}</small>` : ''}`;

        wrap.appendChild(avatar);
        wrap.appendChild(text);

        teacherInfo.innerHTML = '';
        teacherInfo.appendChild(wrap);
      }
    }

    // colegas (students)
    if (classmatesList) {
      classmatesList.innerHTML = '';

      // aceita variações de shape: [{id,...}] ou [{studentId,...}]
      const studentsRaw = Array.isArray(data?.students) ? data.students : [];
      const students = studentsRaw
        .map((s) => ({
          id: s?.id || s?.studentId || '',
          name: s?.name || s?.studentName || '',
          email: s?.email || s?.studentEmail || '',
        }))
        .filter((s) => !!s.id);

      // exclui o próprio aluno
      const classmates = students.filter((s) => s.id !== studentId);

      if (classmates.length === 0) {
        classmatesList.innerHTML = '<li>Nenhum colega ainda (só você na sala).</li>';
        return;
      }

      classmates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      classmates.forEach((s) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '10px';

        const avatar = makeAvatarFromLocalStorage(
          photoKeyStudent(s.id),
          36,
          'Foto do colega',
        );

        const text = document.createElement('div');
        const name = s.name && s.name.trim() ? s.name : 'Aluno';
        const email = s.email && s.email.trim() ? s.email : '';
        text.innerHTML = `<strong>${name}</strong>${email ? `<br><small>${email}</small>` : ''}`;

        li.appendChild(avatar);
        li.appendChild(text);
        classmatesList.appendChild(li);
      });
    }
  } catch {
    if (roomNameEl) roomNameEl.textContent = 'Sala';
    if (teacherInfo) teacherInfo.textContent = 'Erro ao carregar professor.';
    if (classmatesList) classmatesList.innerHTML = '<li>Erro ao carregar colegas.</li>';
  }
}

// tarefas (como estava)
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
      title.textContent = task.title;

      const btn = document.createElement('button');
      btn.textContent = 'Escrever redação';
      btn.onclick = () => (window.location.href = `redacao.html?taskId=${encodeURIComponent(task.id)}`);

      li.appendChild(title);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);

      tasksList.appendChild(li);
    });

    if (status) status.textContent = '';
  } catch {
    if (status) status.textContent = 'Erro ao carregar tarefas.';
    if (tasksList) tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// INIT
carregarOverview();
carregarTarefas();
