// sala-professor.js
// - padrão auth.js
// - destaca tarefa mais recente
// - mostra data de criação das tarefas
// - estudantes com foto, nome e e-mail

import { API_URL } from './config.js';
import { confirmDialog as uiConfirmDialog } from './ui-feedback.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// -----------------------
// Params + Guard
// -----------------------
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  notify('error', 'Acesso inválido', 'Sala inválida.');
  window.location.replace('professor-salas.html');
  throw new Error('roomId ausente');
}

requireProfessorSession({ redirectTo: 'login-professor.html' });

// -----------------------
// Elements
// -----------------------
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

if (performanceBtn) {
  performanceBtn.addEventListener('click', () => {
    window.location.href = `desempenho-professor.html?roomId=${encodeURIComponent(roomId)}`;
  });
}

// -----------------------
// Helpers
// -----------------------
function disable(el, state) {
  if (el) el.disabled = !!state;
}

async function confirmDialog(opts) {
  if (typeof uiConfirmDialog === 'function') {
    try {
      return await uiConfirmDialog(opts);
    } catch {}
  }

  return window.confirm(
    `${opts?.title ? `${opts.title}\n\n` : ''}${opts?.message || 'Confirmar?'}`
  );
}

function unwrapResult(data) {
  if (Array.isArray(data)) return data;

  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (data.result && typeof data.result === 'object') return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return data.data;
  }

  return data;
}

async function apiJson(url, options) {
  const res = await authFetch(url, options || {}, {
    redirectTo: 'login-professor.html',
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  }

  return res.json().catch(() => null);
}

function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function normalizeDateInput(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d2 = new Date(ms);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  return null;
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

function placeholderAvatar(size = 36) {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="${Math.round(size * 0.45)}" text-anchor="middle" fill="#888">?</text>
      </svg>`
    )
  );
}

function photoKeyStudent(studentId) {
  return studentId ? `mk_photo_student_${studentId}` : null;
}

function getStudentPhoto(studentId, size = 36) {
  const key = photoKeyStudent(studentId);
  const dataUrl = key ? localStorage.getItem(key) : null;
  return dataUrl || placeholderAvatar(size);
}

// -----------------------
// Normalizers
// -----------------------
function normalizeStudent(s) {
  return {
    id: String(s?.id || s?.studentId || '').trim(),
    name: String(s?.name || s?.studentName || '').trim(),
    email: String(s?.email || s?.studentEmail || '').trim(),
  };
}

function normalizeTask(t) {
  return {
    id: String(t?.id || t?.taskId || '').trim(),
    title: String(t?.title || t?.taskTitle || t?.name || '').trim(),
    guidelines: String(t?.guidelines || '').trim(),
    createdAt: pickDate(t, [
      'createdAt',
      'created_at',
      'created',
      'dateCreated',
      'timestamp',
      'createdOn',
    ]),
    _raw: t,
  };
}

// -----------------------
// Mais recente
// -----------------------
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
  if (!Array.isArray(tasksNormalized) || tasksNormalized.length === 0) return null;

  const lastCreated = getLastCreatedTaskId();
  if (lastCreated && tasksNormalized.some((t) => String(t.id) === String(lastCreated))) {
    return lastCreated;
  }

  let newestId = null;
  let newestTime = -Infinity;

  tasksNormalized.forEach((t) => {
    const time = normalizeDateInput(t.createdAt)?.getTime?.() ?? NaN;
    if (!Number.isNaN(time) && time > newestTime) {
      newestTime = time;
      newestId = t.id;
    }
  });

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
  badge.style.background = 'rgba(16,185,129,.12)';
  badge.style.border = '1px solid rgba(16,185,129,.35)';
  badge.style.color = '#0b1f4b';
  return badge;
}

// -----------------------
// Sala
// -----------------------
async function carregarSala() {
  try {
    const data = await apiJson(`${API_URL}/rooms/${encodeURIComponent(roomId)}`, {
      method: 'GET',
    });

    const room = unwrapResult(data);
    roomNameEl.textContent = room?.name || 'Sala';
    roomCodeEl.textContent = room?.code || '—';
  } catch (err) {
    console.error(err);
    notify('error', 'Erro', String(err?.message || 'Erro ao carregar dados da sala.'));
  }
}

// -----------------------
// Copiar código
// -----------------------
copyCodeBtn.addEventListener('click', async () => {
  const code = (roomCodeEl.textContent || '').trim();

  if (!code || code === '—') {
    notify('warn', 'Atenção', 'Código da sala indisponível.');
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    notify('success', 'Tudo certo!', 'Código da sala copiado.');
  } catch {
    try {
      const range = document.createRange();
      range.selectNodeContents(roomCodeEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      notify('warn', 'Copie manualmente', 'Selecione e copie com Ctrl+C.');
    } catch {
      notify('error', 'Não foi possível', 'Selecione e copie manualmente.');
    }
  }
});

// -----------------------
// Alunos
// -----------------------
async function removerAluno(studentId, studentName = 'este estudante', btnRef) {
  const ok = await confirmDialog({
    title: 'Remover estudante',
    message: `Remover ${studentName} da sala?`,
    okText: 'Remover',
    cancelText: 'Cancelar',
  });
  if (!ok) return;

  disable(btnRef, true);

  try {
    await apiJson(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/students/${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    );

    await carregarAlunos();
  } catch (err) {
    console.error(err);
    notify('error', 'Erro', String(err?.message || 'Erro ao remover estudante da sala.'));
  } finally {
    disable(btnRef, false);
  }
}

async function carregarAlunos() {
  studentsList.innerHTML = '<li>Carregando estudantes...</li>';

  try {
    const data = await apiJson(
      `${API_URL}/rooms/${encodeURIComponent(roomId)}/students`,
      { method: 'GET' }
    );

    const raw = unwrapResult(data);
    const arr = Array.isArray(raw) ? raw : [];
    const students = arr.map(normalizeStudent).filter((s) => !!s.id);

    studentsList.innerHTML = '';

    if (!students.length) {
      studentsList.innerHTML = '<li>Nenhum estudante matriculado ainda.</li>';
      return;
    }

    students.forEach((student) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '12px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';
      left.style.minWidth = '0';

      const img = document.createElement('img');
      img.alt = 'Foto do estudante';
      img.width = 36;
      img.height = 36;
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.border = '1px solid #ccc';
      img.src = getStudentPhoto(student.id, 36);

      const text = document.createElement('div');
      text.style.minWidth = '0';

      const nameEl = document.createElement('strong');
      nameEl.textContent = student.name || 'Estudante';

      const emailEl = document.createElement('small');
      emailEl.textContent = student.email || 'Sem e-mail cadastrado';
      emailEl.style.display = 'block';

      text.appendChild(nameEl);
      text.appendChild(emailEl);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removerAluno(student.id, student.name || 'este estudante', removeBtn);
      });

      left.appendChild(img);
      left.appendChild(text);
      li.appendChild(left);
      li.appendChild(removeBtn);

      studentsList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    studentsList.innerHTML = '<li>Não foi possível carregar estudantes agora.</li>';
  }
}

// -----------------------
// Tarefas
// -----------------------
async function carregarTarefas() {
  tasksList.innerHTML = '<li>Carregando tarefas...</li>';

  try {
    const data = await apiJson(
      `${API_URL}/tasks/by-room?roomId=${encodeURIComponent(roomId)}`,
      { method: 'GET' }
    );

    const raw = unwrapResult(data);
    const tasks = (Array.isArray(raw) ? raw : [])
      .map(normalizeTask)
      .filter((t) => !!t.id);

    tasksList.innerHTML = '';

    if (!tasks.length) {
      tasksList.innerHTML = '<li>Nenhuma tarefa criada.</li>';
      return;
    }

    const newestId = computeNewestTaskId(tasks);

    tasks.forEach((task) => {
      const li = document.createElement('li');

      if (task.id === newestId) {
        li.style.border = '2px solid rgba(16,185,129,.35)';
        li.style.boxShadow = '0 10px 24px rgba(16,185,129,0.12)';
      }

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

      const meta = document.createElement('div');
      meta.style.marginTop = '6px';
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.textContent = `Criada em: ${formatDateBR(task.createdAt)}`;

      const btnView = document.createElement('button');
      btnView.textContent = 'Ver redações';
      btnView.addEventListener('click', () => {
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

        disable(delBtn, true);

        try {
          await apiJson(`${API_URL}/tasks/${encodeURIComponent(task.id)}`, {
            method: 'DELETE',
          });

          if (String(getLastCreatedTaskId()) === String(task.id)) {
            setLastCreatedTaskId('');
          }

          await carregarTarefas();
        } catch (err) {
          console.error(err);
          notify('error', 'Erro', String(err?.message || 'Erro ao excluir tarefa.'));
        } finally {
          disable(delBtn, false);
        }
      });

      li.appendChild(titleWrap);
      li.appendChild(meta);
      li.appendChild(document.createElement('br'));
      li.appendChild(btnView);
      li.appendChild(delBtn);

      tasksList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// -----------------------
// Criar tarefa
// -----------------------
createTaskBtn.addEventListener('click', async () => {
  const titleEl = document.getElementById('taskTitle');
  const guidelinesEl = document.getElementById('taskGuidelines');

  const title = titleEl?.value?.trim() || '';
  const guidelines = guidelinesEl?.value || '';

  if (!title) {
    notify('warn', 'Campo obrigatório', 'Informe o tema da redação.');
    return;
  }

  disable(createTaskBtn, true);

  try {
    const data = await apiJson(`${API_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ roomId, title, guidelines }),
    });

    const created = unwrapResult(data);
    const createdId = String(created?.id || created?.taskId || '').trim();
    if (createdId) setLastCreatedTaskId(createdId);

    notify('success', 'Criada!', 'Tarefa criada com sucesso.');

    if (titleEl) titleEl.value = '';
    if (guidelinesEl) guidelinesEl.value = '';

    await carregarTarefas();
  } catch (err) {
    console.error(err);
    notify('error', 'Erro', String(err?.message || 'Erro ao criar tarefa.'));
  } finally {
    disable(createTaskBtn, false);
  }
});

// -----------------------
// Init
// -----------------------
carregarSala();
carregarAlunos();
carregarTarefas();
