// sala-professor.js
import { API_URL } from './config.js';
import { toast, confirmDialog } from './ui-feedback.js';

// 🔹 Parâmetros
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  toast({ title: 'Acesso inválido', message: 'Sala inválida.', type: 'error' });
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

if (
  !roomNameEl ||
  !roomCodeEl ||
  !studentsList ||
  !tasksList ||
  !copyCodeBtn ||
  !createTaskBtn
) {
  console.error('Elementos da sala do professor não encontrados.');
  throw new Error('HTML incompleto');
}

// ✅ Botão de desempenho
if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho-professor.html?roomId=${encodeURIComponent(
      roomId
    )}`;
  });
}

// =======================
// Helpers
// =======================

function normalizeStudent(s) {
  const id = String(s?.id || s?.studentId || '').trim();
  const name = String(s?.name || s?.studentName || '').trim();
  const email = String(s?.email || s?.studentEmail || '').trim();
  return { id, name, email };
}

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function normalizeTask(t) {
  const id = String(t?.id || t?.taskId || '').trim();
  const title = String(t?.title || t?.taskTitle || t?.name || '').trim();
  const guidelines = String(t?.guidelines || '');
  const createdAt = pickDate(t, [
    'createdAt',
    'created_at',
    'created',
    'dateCreated',
    'timestamp',
    'createdOn',
  ]);
  return { id, title, guidelines, createdAt, _raw: t };
}

function normalizeDateInput(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    // aceita epoch em segundos ou ms
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  // "YYYY-MM-DD HH:mm(:ss)" -> vira "YYYY-MM-DDTHH:mm(:ss)"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const isoLike = s.replace(' ', 'T');
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBR(value) {
  const d = normalizeDateInput(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return '—';
  }
}

// ----- destaque “mais recente” (igual ao aluno, com badge diferente)

function getLastCreatedTaskKey() {
  return `mk_last_created_task_${roomId}`;
}
function setLastCreatedTaskId(taskId) {
  try {
    localStorage.setItem(getLastCreatedTaskKey(), String(taskId || ''));
  } catch {}
}
function getLastCreatedTaskId() {
  try {
    return localStorage.getItem(getLastCreatedTaskKey()) || '';
  } catch {
    return '';
  }
}

function computeNewestTaskId(tasksNormalized) {
  if (!Array.isArray(tasksNormalized) || tasksNormalized.length === 0)
    return null;

  // ✅ prioridade 1: a última criada via UI (quando criamos agora)
  const lastCreated = getLastCreatedTaskId();
  if (lastCreated && tasksNormalized.some((t) => String(t.id) === String(lastCreated))) {
    return lastCreated;
  }

  // ✅ prioridade 2: maior createdAt válido
  let newestId = null;
  let newestTime = -Infinity;

  tasksNormalized.forEach((t) => {
    const dt = normalizeDateInput(t.createdAt)?.getTime?.() ?? NaN;
    if (!Number.isNaN(dt)) {
      if (dt > newestTime) {
        newestTime = dt;
        newestId = t.id;
      }
    }
  });

  // ✅ fallback: última do array (se backend não manda createdAt)
  if (!newestId) newestId = tasksNormalized[tasksNormalized.length - 1]?.id || null;

  return newestId;
}

function makeMaisRecenteBadge() {
  const badge = document.createElement('span');
  badge.textContent = 'Mais recente';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '3px 10px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '900';
  badge.style.marginLeft = '10px';
  badge.style.background = 'rgba(16,185,129,.12)'; // verde suave
  badge.style.border = '1px solid rgba(16,185,129,.35)';
  badge.style.color = '#0b1f4b';
  return badge;
}

function placeholderAvatar(size = 36) {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="${Math.round(
          size * 0.45
        )}" text-anchor="middle" fill="#888">?</text>
      </svg>`
    )
  );
}

function renderMultiline(el, text, fallback = '') {
  if (!el) return;
  const v = text === null || text === undefined ? '' : String(text);
  el.textContent = v.trim() ? v : fallback;
  el.style.whiteSpace = 'pre-wrap';
  el.style.lineHeight = '1.6';
  el.style.textAlign = 'justify';
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
    toast({
      title: 'Erro',
      message: 'Erro ao carregar dados da sala.',
      type: 'error',
    });
  }
}

// 🔹 Copiar código
copyCodeBtn.addEventListener('click', async () => {
  const code = (roomCodeEl.textContent || '').trim();
  if (!code || code === '—') {
    toast({
      title: 'Atenção',
      message: 'Código da sala indisponível.',
      type: 'warn',
    });
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    toast({
      title: 'Tudo certo!',
      message: 'Código da sala copiado.',
      type: 'success',
    });
  } catch {
    toast({
      title: 'Não foi possível',
      message: 'Selecione e copie manualmente.',
      type: 'error',
    });
  }
});

// =======================
// Alunos
// =======================

async function removerAluno(studentId, studentName = 'este aluno') {
  const ok = await confirmDialog({
    title: 'Remover estudante',
    message: `Remover ${studentName} da sala?`,
    okText: 'Remover',
    cancelText: 'Cancelar',
  });
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/students/${encodeURIComponent(
        studentId
      )}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await carregarAlunos();
  } catch (err) {
    console.error(err);
    toast({
      title: 'Erro',
      message: 'Erro ao remover aluno da sala.',
      type: 'error',
    });
  }
}

async function carregarAlunos() {
  studentsList.innerHTML = '<li>Carregando alunos...</li>';
  const photoKey = (studentId) => `mk_photo_student_${studentId}`;

  try {
    const response = await fetch(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/students`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.json();
    const arr = Array.isArray(raw) ? raw : [];
    const students = arr.map(normalizeStudent).filter((s) => !!s.id);

    studentsList.innerHTML = '';
    if (students.length === 0) {
      studentsList.innerHTML = '<li>Nenhum aluno matriculado ainda.</li>';
      return;
    }

    students.forEach((student) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';

      const img = document.createElement('img');
      img.alt = 'Foto do aluno';
      img.width = 36;
      img.height = 36;
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.border = '1px solid #ccc';

      const dataUrl = localStorage.getItem(photoKey(student.id));
      img.src = dataUrl || placeholderAvatar(36);

      const text = document.createElement('div');
      const name = student.name || 'Aluno';
      const email = student.email || '';
      text.innerHTML = `<strong>${name}</strong>${
        email ? `<br><small>${email}</small>` : ''
      }`;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removerAluno(student.id, name);
      });

      left.appendChild(img);
      left.appendChild(text);
      li.appendChild(left);
      li.appendChild(removeBtn);
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

async function carregarTarefas() {
  tasksList.innerHTML = '<li>Carregando tarefas...</li>';

  try {
    const response = await fetch(
      `${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.json();
    const tasks = (Array.isArray(raw) ? raw : [])
      .map(normalizeTask)
      .filter((t) => !!t.id);

    tasksList.innerHTML = '';
    if (tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa criada.</li>';
      return;
    }

    const newestId = computeNewestTaskId(tasks);

    tasks.forEach((task) => {
      const li = document.createElement('li');

      // ✅ destaque visual da mais recente
      if (task.id === newestId) {
        li.style.border = '2px solid rgba(16,185,129,.35)';
        li.style.boxShadow = '0 10px 24px rgba(16,185,129,0.12)';
      }

      // título + badge
      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.flexWrap = 'wrap';
      titleWrap.style.gap = '6px';

      const title = document.createElement('strong');
      title.textContent = task.title || 'Tarefa';
      titleWrap.appendChild(title);

      if (task.id === newestId) {
        titleWrap.appendChild(makeMaisRecenteBadge());
      }

      // meta data
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
      delBtn.className = 'danger';
      delBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Excluir tarefa',
          message: `Excluir a tarefa "${task.title || 'sem título'}"?`,
          okText: 'Excluir',
          cancelText: 'Cancelar',
        });
        if (!ok) return;

        try {
          const res = await fetch(`${API_URL}/tasks/${encodeURIComponent(task.id)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // se apagou a “última criada”, limpa o marcador
          if (String(getLastCreatedTaskId()) === String(task.id)) {
            setLastCreatedTaskId('');
          }

          carregarTarefas();
        } catch (err) {
          console.error(err);
          toast({ title: 'Erro', message: 'Erro ao excluir tarefa.', type: 'error' });
        }
      });

      li.appendChild(titleWrap);
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
  const guidelines = guidelinesEl?.value || '';

  if (!title) {
    toast({ title: 'Campo obrigatório', message: 'Informe o tema da redação.', type: 'warn' });
    return;
  }

  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, title, guidelines }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const created = await response.json().catch(() => null);

    // ✅ tenta salvar o ID da tarefa recém-criada para destacar
    const createdId = String(created?.id || created?.taskId || '').trim();
    if (createdId) setLastCreatedTaskId(createdId);

    toast({ title: 'Criada!', message: 'Tarefa criada com sucesso.', type: 'success' });

    if (titleEl) titleEl.value = '';
    if (guidelinesEl) guidelinesEl.value = '';

    carregarTarefas();
  } catch (err) {
    console.error(err);
    toast({ title: 'Erro', message: 'Erro ao criar tarefa.', type: 'error' });
  }
});

// =======================
// INIT
// =======================
carregarSala();
carregarAlunos();
carregarTarefas();
