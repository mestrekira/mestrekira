import { API_URL } from './config.js';
import { toast } from './ui-feedback.js'; // se não quiser toast aqui, posso tirar

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
};

function notify(type, title, message, duration) {
  // fallback caso ui-feedback não exista nesta página
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } else {
    // fallback mínimo
    if (type === 'error') alert(`${title}\n\n${message}`);
    else console.log(title, message);
  }
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function redirectToLogin() {
  // marca que veio de logout/expiração? (opcional)
  window.location.replace('login-professor.html');
}

function requireProfessorSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || role !== 'PROFESSOR') {
    clearAuthStorage();
    redirectToLogin();
    throw new Error('Sessão de professor ausente/inválida');
  }

  // mantém compatibilidade para páginas antigas
  if (user?.id) localStorage.setItem(LS.professorId, String(user.id));

  return { token, user };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function unwrapResult(data) {
  // suporta: [..] OU { ok:true, result:[..] }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) return data.data; // caso algum endpoint use "data"
  }
  return null;
}

async function apiFetch(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // se token expirou / acesso negado, volta pro login limpando tudo
  if (res.status === 401 || res.status === 403) {
    clearAuthStorage();
    redirectToLogin();
    throw new Error(`Auth error: HTTP ${res.status}`);
  }

  const data = await readJsonSafe(res);
  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// --------------------
// Página
// --------------------
const roomsList = document.getElementById('roomsList');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomName');

// garante sessão
const { token, user } = requireProfessorSession();
// const professorId = String(user.id); // se ainda precisar localmente

async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    // ✅ ideal: backend lê professorId pelo token.
    // Mantive query por compatibilidade (se o endpoint ainda exige), mas pode remover depois.
    const professorId = String(user.id);
    const data = await apiFetch(
      `/rooms/by-professor?professorId=${encodeURIComponent(professorId)}`,
      { token },
    );

    const rooms = unwrapResult(data);
    roomsList.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    for (const room of rooms) {
      const li = document.createElement('li');

      // nome
      const nameSpan = document.createElement('span');
      nameSpan.textContent = String(room?.name || 'Sala');
      li.appendChild(nameSpan);
      li.appendChild(document.createTextNode(' '));

      // acessar
      const btn = document.createElement('button');
      btn.textContent = 'Acessar';
      btn.addEventListener('click', () => {
        window.location.href = `sala-professor.html?roomId=${encodeURIComponent(room.id)}`;
      });

      // excluir
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.addEventListener('click', async () => {
        const ok = confirm(`Excluir a sala "${String(room?.name || '')}"?`);
        if (!ok) return;

        disable(delBtn, true);

        try {
          await apiFetch(`/rooms/${encodeURIComponent(room.id)}`, {
            token,
            method: 'DELETE',
          });

          notify('success', 'Sala excluída', 'A sala foi excluída com sucesso.', 1800);
          await carregarSalas();
        } catch (e) {
          notify('error', 'Erro ao excluir', String(e?.message || 'Falha ao excluir sala.'));
        } finally {
          disable(delBtn, false);
        }
      });

      li.appendChild(btn);
      li.appendChild(delBtn);
      roomsList.appendChild(li);
    }
  } catch (e) {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
    notify('error', 'Erro', String(e?.message || 'Não foi possível carregar as salas.'));
  }
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

if (createRoomBtn && roomNameInput) {
  createRoomBtn.addEventListener('click', async () => {
    const name = String(roomNameInput.value || '').trim();
    if (!name) {
      notify('warn', 'Nome obrigatório', 'Informe o nome da sala.');
      return;
    }

    disable(createRoomBtn, true);

    try {
      // ✅ ideal: backend pega professorId pelo token.
      // Mantive professorId no body por compatibilidade caso seu endpoint exija.
      const professorId = String(user.id);

      await apiFetch('/rooms', {
        token,
        method: 'POST',
        body: { name, professorId },
      });

      roomNameInput.value = '';
      notify('success', 'Sala criada', 'Sua sala foi criada com sucesso.', 1600);
      await carregarSalas();
    } catch (e) {
      notify('error', 'Erro ao criar', String(e?.message || 'Erro ao criar sala.'));
    } finally {
      disable(createRoomBtn, false);
    }
  });
}

carregarSalas();
