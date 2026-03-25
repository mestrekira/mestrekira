import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';
import { requireStudentSession, authFetch, readErrorMessage } from './auth.js';

// =====================
// Estado da sala
// =====================
let isRoomActive = true;

// =====================
// Toast helper
// =====================
function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } catch {
    if (type === 'error') console.error(title, message);
  }
}

// =====================
// jsonSafe
// =====================
async function jsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// =====================
// Params + Guard
// =====================
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  notify('error', 'Sala inválida', 'Abra a sala por um link válido.');
  window.location.replace('painel-aluno.html');
  throw new Error('roomId ausente');
}

const studentId = requireStudentSession({ redirectTo: 'login-aluno.html' });

// =====================
// Elements
// =====================
const roomNameEl = document.getElementById('roomName');
const tasksList = document.getElementById('tasksList');
const statusEl = document.getElementById('status');

const teacherInfo = document.getElementById('teacherInfo');
const classmatesList = document.getElementById('classmatesList');

const leaveBtn = document.getElementById('leaveRoomBtn');
const leaveStatus = document.getElementById('leaveStatus');

const performanceBtn = document.getElementById('performanceBtn');
if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho.html?roomId=${encodeURIComponent(roomId)}`;
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

// =====================
// Datas
// =====================
function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    const t = d.getTime();
    return Number.isNaN(t) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d0 = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d0.getTime()) ? null : d0;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const d2 = new Date(asNum);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  return null;
}

function formatDateBR(value) {
  const d = toDateSafe(value);
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

// =====================
// Fotos
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

  img.src =
    dataUrl ||
    'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eee"/>
          <text x="50%" y="55%" font-size="${Math.round(
            size * 0.45
          )}" text-anchor="middle" fill="#888">?</text>
        </svg>`
      );

  return img;
}

// =====================
// Sair da sala
// =====================
if (leaveBtn) {
  leaveBtn.addEventListener('click', async () => {
    const ok = confirm('Tem certeza que deseja sair desta sala?');
    if (!ok) return;

    if (leaveStatus) leaveStatus.textContent = 'Saindo...';

    try {
      const res = await authFetch(
        `${API_URL}/enrollments/leave`,
        {
          method: 'DELETE',
          body: JSON.stringify({ roomId, studentId }),
        },
        { redirectTo: 'login-aluno.html' }
      );

      if (!res.ok) {
        const msg = await readErrorMessage(res, `HTTP ${res.status}`);
        throw new Error(msg);
      }

      if (leaveStatus) leaveStatus.textContent = 'Você saiu da sala.';
      notify('success', 'Tudo certo', 'Você saiu da sala.');
      setTimeout(() => window.location.replace('painel-aluno.html'), 700);
    } catch (e) {
      const msg = String(e?.message || '');

      if (msg === 'AUTH_401') return;

      if (msg === 'AUTH_403') {
        if (leaveStatus) {
          leaveStatus.textContent = 'Você não tem permissão para sair desta sala.';
        }
        notify('warn', 'Acesso negado', 'Você não tem permissão para sair desta sala.');
        return;
      }

      console.error(e);
      if (leaveStatus) leaveStatus.textContent = 'Erro ao sair da sala.';
      notify('error', 'Erro', 'Não foi possível sair da sala agora.');
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
    const res = await authFetch(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/overview-student`,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    const data = await jsonSafe(res);

    if (roomNameEl) roomNameEl.textContent = data?.room?.name || 'Sala';

    // status da sala
    isRoomActive = data?.room?.isActive !== false;

    if (!isRoomActive) {
      if (roomNameEl) {
        roomNameEl.style.opacity = '0.75';
        if (!String(roomNameEl.textContent || '').includes('(Desativada)')) {
          roomNameEl.textContent = `${roomNameEl.textContent} (Desativada)`;
        }
      }

      notify(
        'warn',
        'Sala desativada',
        'Esta sala foi desativada pela escola. Não é possível enviar novas redações.'
      );
    }

    if (teacherInfo) {
      const p = data?.professor;
      teacherInfo.innerHTML = '';

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
          'Foto do professor'
        );

        const text = document.createElement('div');

        const name = String(p.name || 'Professor').trim();
        const email = String(p.email || '').trim();

        const strong = document.createElement('strong');
        strong.textContent = name;
        text.appendChild(strong);

        if (email) {
          const br = document.createElement('br');
          const small = document.createElement('small');
          small.textContent = email;
          text.appendChild(br);
          text.appendChild(small);
        }

        wrap.appendChild(avatar);
        wrap.appendChild(text);

        teacherInfo.appendChild(wrap);
      }
    }

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

        const avatar = makeAvatarFromLocalStorage(
          photoKeyStudent(s.id),
          36,
          'Foto do colega'
        );

        const text = document.createElement('div');

        const name = s.name && s.name.trim() ? s.name : 'Aluno';
        const email = s.email && s.email.trim() ? s.email : '';

        const strong = document.createElement('strong');
        strong.textContent = name;
        text.appendChild(strong);

        if (email) {
          const br = document.createElement('br');
          const small = document.createElement('small');
          small.textContent = email;
          text.appendChild(br);
          text.appendChild(small);
        }

        li.appendChild(avatar);
        li.appendChild(text);
        classmatesList.appendChild(li);
      });
    }
  } catch (e) {
    const msg = String(e?.message || '');

    if (msg === 'AUTH_401') return;

    if (msg === 'AUTH_403') {
      if (roomNameEl) roomNameEl.textContent = 'Sala';
      if (teacherInfo) {
        teacherInfo.textContent = 'Você não tem permissão para visualizar esta sala.';
      }
      if (classmatesList) {
        classmatesList.innerHTML = '<li>Acesso não autorizado.</li>';
      }
      return;
    }

    console.error(e);
    if (roomNameEl) roomNameEl.textContent = 'Sala';
    if (teacherInfo) teacherInfo.textContent = 'Erro ao carregar professor.';
    if (classmatesList) classmatesList.innerHTML = '<li>Erro ao carregar colegas.</li>';
  }
}

// =====================
// Essay do aluno na tarefa
// =====================
async function getMyEssayByTask(taskIdValue) {
  const url =
    `${API_URL}/essays/by-task/${encodeURIComponent(taskIdValue)}/by-student` +
    `?studentId=${encodeURIComponent(studentId)}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await jsonSafe(res);
    return data || null;
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg !== 'AUTH_401' && msg !== 'AUTH_403') {
      console.error(e);
    }
    return null;
  }
}

// =====================
// Destaque da tarefa mais recente
// =====================
function computeNewestTaskId(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  let newestId = null;
  let newestTime = -Infinity;

  tasks.forEach((t) => {
    const createdAt = pickDate(t, [
      'createdAt',
      'created_at',
      'created',
      'dateCreated',
      'timestamp',
    ]);
    const dt = toDateSafe(createdAt)?.getTime?.() ?? NaN;

    if (!Number.isNaN(dt)) {
      if (dt > newestTime) {
        newestTime = dt;
        newestId = t.id;
      }
    }
  });

  if (!newestId) newestId = tasks[tasks.length - 1]?.id || null;
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

  setStatus('Carregando tarefas...');
  tasksList.innerHTML = '<li>Carregando...</li>';

  try {
    const res = await authFetch(
      `${API_URL}/tasks/by-room-student?roomId=${encodeURIComponent(roomId)}`,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    const raw = await jsonSafe(res);
    const arr = Array.isArray(raw) ? raw : [];

    tasksList.innerHTML = '';

    if (arr.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      setStatus('');
      return;
    }

    const tasks = arr
      .map((t) => {
        const id = String(t?.id || t?.taskId || '').trim();
        const title = String(t?.title || t?.taskTitle || t?.name || '').trim();
        const createdAt = pickDate(t, [
          'createdAt',
          'created_at',
          'created',
          'dateCreated',
          'timestamp',
        ]);
        return { id, title, createdAt, _raw: t };
      })
      .filter((t) => !!t.id);

    if (tasks.length === 0) {
      tasksList.innerHTML = '<li>Nenhuma tarefa disponível.</li>';
      setStatus('');
      return;
    }

    const newestId = computeNewestTaskId(
      tasks.map((t) => ({ ...t._raw, id: t.id }))
    );

    const uiByTaskId = new Map();

    tasks.forEach((task) => {
      const li = document.createElement('li');

      if (task.id === newestId) {
        li.style.border = '2px solid rgba(109,40,217,.35)';
        li.style.boxShadow = '0 10px 24px rgba(109,40,217,0.12)';
      }

      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.flexWrap = 'wrap';
      titleWrap.style.gap = '6px';

      const title = document.createElement('strong');
      title.textContent = task.title || 'Tarefa';
      titleWrap.appendChild(title);

      if (task.id === newestId) titleWrap.appendChild(makeNovaBadge());

      const meta = document.createElement('div');
      meta.style.marginTop = '6px';
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.textContent = `Criada em: ${formatDateBR(task.createdAt)}`;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.marginTop = '8px';
      actions.style.flexWrap = 'wrap';

      const btnWrite = document.createElement('button');
      btnWrite.type = 'button';
      btnWrite.textContent = isRoomActive ? 'Escrever redação' : 'Sala desativada';
      btnWrite.disabled = !isRoomActive;
      btnWrite.onclick = () => {
        if (!isRoomActive) {
          notify(
            'error',
            'Ação bloqueada',
            'Esta sala está desativada e não permite envio de redações.'
          );
          return;
        }

        window.location.href = `redacao.html?taskId=${encodeURIComponent(task.id)}`;
      };

      const btnFeedback = document.createElement('button');
      btnFeedback.type = 'button';
      btnFeedback.textContent = 'Feedback';
      btnFeedback.style.display = 'none';

      actions.appendChild(btnWrite);
      actions.appendChild(btnFeedback);

      li.appendChild(titleWrap);
      li.appendChild(meta);
      li.appendChild(actions);

      tasksList.appendChild(li);
      uiByTaskId.set(task.id, { btnWrite, btnFeedback });
    });

    const checks = await Promise.allSettled(
      tasks.map(async (task) => {
        const essay = await getMyEssayByTask(task.id);
        return { taskId: task.id, essay };
      })
    );

    checks.forEach((r) => {
      if (r.status !== 'fulfilled') return;

      const { taskId, essay } = r.value;
      const ui = uiByTaskId.get(taskId);
      if (!ui) return;

      if (essay && essay.id && essay.isDraft === false) {
        ui.btnWrite.style.display = 'none';
        ui.btnFeedback.style.display = 'inline-block';
        ui.btnFeedback.onclick = () => {
          window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
        };
      } else {
        ui.btnFeedback.style.display = 'none';
        ui.btnWrite.style.display = 'inline-block';
        ui.btnWrite.disabled = !isRoomActive;
        ui.btnWrite.textContent = isRoomActive ? 'Escrever redação' : 'Sala desativada';
      }
    });

    setStatus('');
  } catch (e) {
    const msg = String(e?.message || '');

    if (msg === 'AUTH_401') return;

    if (msg === 'AUTH_403') {
      setStatus('Você não tem permissão para visualizar as tarefas desta sala.');
      if (tasksList) {
        tasksList.innerHTML = '<li>Acesso não autorizado às tarefas.</li>';
      }
      return;
    }

    console.error(e);
    setStatus('Erro ao carregar tarefas.');
    if (tasksList) tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// INIT
carregarOverview();
carregarTarefas();
