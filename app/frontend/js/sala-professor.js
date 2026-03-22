// sala-professor.js (REFATORADO FINAL - padrão JWT)

// ---------------- IMPORTS ----------------
import { API_URL } from './config.js';
import { confirmDialog as uiConfirmDialog } from './ui-feedback.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// ---------------- GUARD ----------------
requireProfessorSession({ redirectTo: 'login-professor.html' });

// ---------------- PARAMS ----------------
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  notify('error', 'Acesso inválido', 'Sala inválida.');
  window.location.replace('professor-salas.html');
  throw new Error('roomId ausente');
}

// ---------------- ELEMENTOS ----------------
const roomNameEl = document.getElementById('roomName');
const roomCodeEl = document.getElementById('roomCode');
const studentsList = document.getElementById('studentsList');
const tasksList = document.getElementById('tasksList');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const createTaskBtn = document.getElementById('createTaskBtn');
const performanceBtn = document.getElementById('performanceBtn');

// ---------------- HELPERS ----------------
function disable(el, state) {
  if (el) el.disabled = !!state;
}

async function confirmDialog(opts) {
  if (typeof uiConfirmDialog === 'function') {
    try {
      return await uiConfirmDialog(opts);
    } catch {}
  }
  return window.confirm(`${opts?.title || ''}\n\n${opts?.message || 'Confirmar?'}`);
}

async function api(url, options = {}) {
  const res = await authFetch(url, options, {
    redirectTo: 'login-professor.html',
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res, `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return res.json().catch(() => null);
}

function unwrap(data) {
  if (Array.isArray(data)) return data;
  if (data?.result) return data.result;
  if (data?.data) return data.data;
  return data;
}

// ---------------- SALA ----------------
async function carregarSala() {
  try {
    const data = await api(`${API_URL}/rooms/${roomId}`);
    const room = unwrap(data);

    roomNameEl.textContent = room?.name || 'Sala';
    roomCodeEl.textContent = room?.code || '—';
  } catch (e) {
    notify('error', 'Erro', e.message);
  }
}

// ---------------- COPIAR CÓDIGO ----------------
copyCodeBtn.onclick = async () => {
  const code = roomCodeEl.textContent;

  try {
    await navigator.clipboard.writeText(code);
    notify('success', 'Copiado!', 'Código da sala copiado.');
  } catch {
    notify('warn', 'Copie manualmente', 'Use Ctrl+C.');
  }
};

// ---------------- ALUNOS ----------------
async function carregarAlunos() {
  studentsList.innerHTML = '<li>Carregando...</li>';

  try {
    const data = await api(`${API_URL}/rooms/${roomId}/students`);
    const students = unwrap(data) || [];

    studentsList.innerHTML = '';

    if (!students.length) {
      studentsList.innerHTML = '<li>Nenhum aluno.</li>';
      return;
    }

    students.forEach((s) => {
      const li = document.createElement('li');

      const name = document.createElement('strong');
      name.textContent = s.name || 'Aluno';

      const btn = document.createElement('button');
      btn.textContent = 'Remover';

      btn.onclick = async () => {
        const ok = await confirmDialog({
          title: 'Remover aluno',
          message: `Remover ${s.name || 'aluno'}?`,
        });

        if (!ok) return;

        await api(`${API_URL}/rooms/${roomId}/students/${s.id}`, {
          method: 'DELETE',
        });

        carregarAlunos();
      };

      li.appendChild(name);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(btn);

      studentsList.appendChild(li);
    });
  } catch {
    studentsList.innerHTML = '<li>Erro ao carregar alunos.</li>';
  }
}

// ---------------- TAREFAS ----------------
async function carregarTarefas() {
  tasksList.innerHTML = '<li>Carregando...</li>';

  try {
    const data = await api(`${API_URL}/tasks/by-room?roomId=${roomId}`);
    const tasks = unwrap(data) || [];

    tasksList.innerHTML = '';

    if (!tasks.length) {
      tasksList.innerHTML = '<li>Nenhuma tarefa.</li>';
      return;
    }

    tasks.forEach((t) => {
      const li = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = t.title || 'Tarefa';

      const btn = document.createElement('button');
      btn.textContent = 'Ver redações';
      btn.onclick = () => {
        window.location.href = `correcao.html?taskId=${t.id}`;
      };

      const del = document.createElement('button');
      del.textContent = 'Excluir';

      del.onclick = async () => {
        const ok = await confirmDialog({
          title: 'Excluir tarefa',
          message: `Excluir "${t.title}"?`,
        });

        if (!ok) return;

        await api(`${API_URL}/tasks/${t.id}`, {
          method: 'DELETE',
        });

        carregarTarefas();
      };

      li.appendChild(title);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);
      li.appendChild(del);

      tasksList.appendChild(li);
    });
  } catch {
    tasksList.innerHTML = '<li>Erro ao carregar tarefas.</li>';
  }
}

// ---------------- CRIAR TAREFA ----------------
createTaskBtn.onclick = async () => {
  const title = document.getElementById('taskTitle')?.value?.trim();
  const guidelines = document.getElementById('taskGuidelines')?.value || '';

  if (!title) {
    notify('warn', 'Campo obrigatório', 'Informe o tema.');
    return;
  }

  disable(createTaskBtn, true);

  try {
    // ✅ SEM professorId
    await api(`${API_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ roomId, title, guidelines }),
    });

    notify('success', 'Criado!', 'Tarefa criada.');
    carregarTarefas();
  } catch (e) {
    notify('error', 'Erro', e.message);
  } finally {
    disable(createTaskBtn, false);
  }
};

// ---------------- PERFORMANCE ----------------
if (performanceBtn) {
  performanceBtn.onclick = () => {
    window.location.href = `desempenho-professor.html?roomId=${roomId}`;
  };
}

// ---------------- INIT ----------------
carregarSala();
carregarAlunos();
carregarTarefas();
