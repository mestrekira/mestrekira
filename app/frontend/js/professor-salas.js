// professor-salas.js (refatorado PRO)

// ---------------- IMPORTS ----------------
import { API_URL } from './config.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// ---------------- GUARD ----------------
requireProfessorSession({ redirectTo: 'login-professor.html' });

// ---------------- ELEMENTOS ----------------
const roomsList = document.getElementById('roomsList');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomName');

// ---------------- HELPERS ----------------
function disable(el, state) {
  if (el) el.disabled = !!state;
}

function unwrapResult(data) {
  if (Array.isArray(data)) return data;
  if (data?.result && Array.isArray(data.result)) return data.result;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

async function apiRequest(url, options = {}) {
  const res = await authFetch(url, options, {
    redirectTo: 'login-professor.html',
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res, `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return res.json().catch(() => null);
}

// ---------------- CARREGAR SALAS ----------------
async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    // ✅ AGORA SEM professorId
    const data = await apiRequest(`${API_URL}/rooms/by-professor`);

    const rooms = unwrapResult(data);

    roomsList.innerHTML = '';

    if (!rooms.length) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
      const roomId = String(room?.id || '').trim();

      const li = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = room?.name || 'Sala';

      const acessar = document.createElement('button');
      acessar.textContent = 'Acessar';
      acessar.onclick = () => {
        if (!roomId) return;
        window.location.href = `sala-professor.html?roomId=${encodeURIComponent(roomId)}`;
      };

      const excluir = document.createElement('button');
      excluir.textContent = 'Excluir';

      excluir.onclick = async () => {
        if (!roomId) return;

        const ok = confirm(`Excluir a sala "${room?.name || ''}"?`);
        if (!ok) return;

        disable(excluir, true);

        try {
          await apiRequest(`${API_URL}/rooms/${roomId}`, {
            method: 'DELETE',
          });

          notify('success', 'Sala excluída', 'A sala foi removida.');
          await carregarSalas();
        } catch (e) {
          notify('error', 'Erro', e.message);
        } finally {
          disable(excluir, false);
        }
      };

      li.appendChild(name);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(acessar);
      li.appendChild(excluir);

      roomsList.appendChild(li);
    });
  } catch (e) {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
    notify('error', 'Erro', e.message);
  }
}

// ---------------- CRIAR SALA ----------------
if (createRoomBtn && roomNameInput) {
  createRoomBtn.addEventListener('click', async () => {
    const name = String(roomNameInput.value || '').trim();

    if (!name) {
      notify('warn', 'Nome obrigatório', 'Informe o nome da sala.');
      return;
    }

    disable(createRoomBtn, true);

    try {
      // ✅ SEM professorId
      await apiRequest(`${API_URL}/rooms`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      roomNameInput.value = '';

      notify('success', 'Sala criada', 'Sua sala foi criada.');
      await carregarSalas();
    } catch (e) {
      notify('error', 'Erro ao criar', e.message);
    } finally {
      disable(createRoomBtn, false);
    }
  });
}

// ---------------- INIT ----------------
carregarSalas();
