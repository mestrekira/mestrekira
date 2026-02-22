// professor-salas.js (final / padrão auth.js)
// - lista/cria/exclui salas do professor
// - usa auth.js (notify + requireProfessorSession + authFetch + readErrorMessage + getUser)
// - compat: aceita endpoints que retornam { ok, result: [...] } ou { data: [...] } ou array direto

import { API_URL } from './config.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
  getUser,
} from './auth.js';

// --------------------
// Guard: sessão professor (1x no topo)
// --------------------
const professorIdCompat = requireProfessorSession({ redirectTo: 'login-professor.html' });
const user = getUser() || null;

// --------------------
// Página
// --------------------
const roomsList = document.getElementById('roomsList');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomName');

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function unwrapResult(data) {
  // suporta: [..] OU { ok:true, result:[..] } OU { data:[..] }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) return data.data;
  }
  // fallback seguro para este arquivo (esperamos lista)
  return [];
}

// --------------------
// API helpers (padrão authFetch)
// --------------------
async function apiGetJson(url) {
  const res = await authFetch(url, { method: 'GET' }, { redirectTo: 'login-professor.html' });
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function apiDelete(url) {
  const res = await authFetch(url, { method: 'DELETE' }, { redirectTo: 'login-professor.html' });
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function apiPostJson(url, body) {
  const res = await authFetch(
    url,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
    { redirectTo: 'login-professor.html' }
  );
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

// --------------------
// Carregar salas
// --------------------
async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    // ✅ ideal: backend lê professorId pelo token.
    // Mantemos query por compatibilidade (se o endpoint ainda exige).
    const professorId = String(user?.id || professorIdCompat || '').trim();

    const data = await apiGetJson(
      `${API_URL}/rooms/by-professor?professorId=${encodeURIComponent(professorId)}`
    );

    const rooms = unwrapResult(data);
    roomsList.innerHTML = '';

    if (!rooms.length) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    for (const room of rooms) {
      const roomId = String(room?.id || '').trim();

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
        if (!roomId) return;
        window.location.href = `sala-professor.html?roomId=${encodeURIComponent(roomId)}`;
      });

      // excluir
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.addEventListener('click', async () => {
        if (!roomId) return;

        const ok = confirm(`Excluir a sala "${String(room?.name || '')}"?`);
        if (!ok) return;

        disable(delBtn, true);

        try {
          await apiDelete(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
          notify('success', 'Sala excluída', 'A sala foi excluída com sucesso.', 1800);
          await carregarSalas();
        } catch (e) {
          const msg = String(e?.message || 'Falha ao excluir sala.');
          notify('error', 'Erro ao excluir', msg);
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
    const msg = String(e?.message || 'Não foi possível carregar as salas.');
    notify('error', 'Erro', msg);
  }
}

// --------------------
// Criar sala
// --------------------
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
      // Mantemos professorId no body por compatibilidade caso seu endpoint exija.
      const professorId = String(user?.id || professorIdCompat || '').trim();

      await apiPostJson(`${API_URL}/rooms`, { name, professorId });

      roomNameInput.value = '';
      notify('success', 'Sala criada', 'Sua sala foi criada com sucesso.', 1600);
      await carregarSalas();
    } catch (e) {
      const msg = String(e?.message || 'Erro ao criar sala.');
      notify('error', 'Erro ao criar', msg);
    } finally {
      disable(createRoomBtn, false);
    }
  });
}

// INIT
carregarSalas();
