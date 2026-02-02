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

const performanceBtn = document.getElementById('performanceBtn');
if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho.html?roomId=${encodeURIComponent(roomId)}`;
  });
}

// =====================
// Fotos (localStorage)
// =====================
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
          <text x="50%" y="55%" font-size="${Math.round(
            size * 0.45
          )}" text-anchor="middle" fill="#888">?</text>
        </svg>`
      );
  }
  return img;
}

// =====================
// Sair da sala
// =====================
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

// =====================
// Sala + professor + colegas
// =====================
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

        const avatar = makeAvatarFromLocalStorage(photoKeyProfessor(p.id), 38, 'Foto do professor');

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

    // colegas
    if (classmatesList) {
      classmatesList.innerHTML = '';

      const studentsRaw = Array.isArray(data?.students) ? data.students : [];
      const students = studentsRaw
        .map((s) => ({
          id: String(s?.id || s?.studentId || '').trim(),
          name: String(s?.name || s?.studentName || '').trim(),
          email: String(s?.email || s?.studentEmail || '').trim(),
        }))
        .filter((s) => !!s.id);

      const classmates = students.filter((s) => String(s.id) !== String(studentId));

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

        const avatar = makeAvatarFromLocalStorage(photoKeyStudent(s.id), 36, 'Foto do colega');

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

// =====================
// Essay do aluno na tarefa
// =====================
async function getMyEssayByTask(taskId) {
  const url =
    `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/by-student` +
    `?studentId=${encodeURIComponent(studentId)}`;

  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn('[sala-aluno] Falha ao consultar essay da tarefa', taskId, res.status);
    return null;
  }

  const data = await res.json().catch(() => null);
  return data || null;
}

// =====================
// Destaque da tarefa mais recente ("Nova")
// =====================
function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v) return v;
  }
  return null;
}

function computeNewestTaskId(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  let newestId = null;
  let newestTime = -Infinity;

  tasks.forEach((t) => {
    const createdAt = pickDate(t, ['createdAt', 'created_at', 'created', 'dateCreated', 'timestamp']);
    const dt = createdAt ? new Date(createdAt).getTime() : NaN;
    if (!Number.isNaN(dt)) {
      if (dt > newestTime) {
        newestTime = dt;
        newestId = t.id;
      }
    }
  });

  // fallback: última do array
  if (!newestId) newestId = tasks[tasks.length - 1].id;

  return newestId;
}

function makeNovaBadge() {
  const badge = document.createElement('span');
  badge.textContent = 'Nova';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '3px 8px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '900';
  badge.style.marginLeft = '10px';
  badge.style.background = 'rgba(109,40,217,.12)';
  badge.style.border = '1px solid rgba(109,40,217,.35)';
  badge.style.color = '#0b1f4b';
  return badge;
}

// =====================
// Tarefas
// =====================
async function carregarTarefas() {
  if (!tasksList) return;

  try {
    const response = await fetch(`${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`);
    if (!response.ok) throw new Error();

    const raw = await response.json();
    const arr = Array.isArray(raw) ? raw : [];

    tasksList.innerHTML = '';

    if (arr.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      if (status) status.textContent = '';
      return;
    }

    // normaliza pra garantir .id/.title
    const tasks = arr
      .map((t) => ({
        id: String(t?.id || t?.taskId || '').trim(),
        title: String(t?.title || t?.taskTitle || t?.name || '').trim(),
        _raw: t,
      }))
      .filter((t) => !!t.id);

    if (tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      if (status) status.textContent = '';
      return;
    }

    const newestId = computeNewestTaskId(tasks.map((t) => ({ ...t, ...t._raw })));

    // renderiza e atualiza botões
    for (const task of tasks) {
      const li = document.createElement('li');

      // ✅ destaque da tarefa mais recente
      if (task.id === newestId) {
        li.style.border = '2px solid rgba(109,40,217,.35)';
        li.style.boxShadow = '0 10px 24px rgba(109,40,217,0.12)';
      }

      // título + badge Nova
      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.flexWrap = 'wrap';
      titleWrap.style.gap = '6px';

      const title = document.createElement('strong');
      title.textContent = task.title || 'Tarefa';

      titleWrap.appendChild(title);

      if (task.id === newestId) {
        titleWrap.appendChild(makeNovaBadge());
      }

      // wrapper botões
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.marginTop = '8px';
      actions.style.flexWrap = 'wrap';

      // Botão Escrever
      const btnWrite = document.createElement('button');
      btnWrite.textContent = 'Escrever redação';
      btnWrite.onclick = () => {
        window.location.href = `redacao.html?taskId=${encodeURIComponent(task.id)}`;
      };

      // Botão Feedback (começa escondido)
      const btnFeedback = document.createElement('button');
      btnFeedback.textContent = 'Feedback';
      btnFeedback.style.display = 'none';
      btnFeedback.onclick = () => {};

      actions.appendChild(btnWrite);
      actions.appendChild(btnFeedback);

      li.appendChild(titleWrap);
      li.appendChild(document.createElement('br'));
      li.appendChild(actions);

      tasksList.appendChild(li);

      // ✅ checa se já existe essay enviada
      try {
        const essay = await getMyEssayByTask(task.id);

        if (essay && essay.id && essay.isDraft === false) {
          btnWrite.style.display = 'none';
          btnFeedback.style.display = 'inline-block';
          btnFeedback.onclick = () => {
            window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
          };
        } else {
          btnFeedback.style.display = 'none';
          btnWrite.style.display = 'inline-block';
        }
      } catch (e) {
        console.warn('[sala-aluno] Erro ao checar status da redação', task.id, e);
        btnFeedback.style.display = 'none';
        btnWrite.style.display = 'inline-block';
      }
    }

    if (status) status.textContent = '';
  } catch {
    if (status) status.textContent = 'Erro ao carregar tarefas.';
    if (tasksList) tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// INIT
carregarOverview();
carregarTarefas();
