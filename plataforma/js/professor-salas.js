import { API_URL } from './config.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

requireProfessorSession({ redirectTo: 'login-professor.html' });

const roomsList = document.getElementById('roomsList');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomName');

function disable(el, state) {
  if (el) el.disabled = !!state;
}

function unwrapResult(data) {
  if (Array.isArray(data)) return data;
  if (data?.result && Array.isArray(data.result)) return data.result;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

function isActiveRoom(room) {
  return room?.isActive !== false;
}

function statusText(room) {
  return isActiveRoom(room) ? 'Ativa' : 'Inativa';
}

function confirmDialog({
  title = 'Confirmar ação',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const h3 = document.createElement('h3');
    h3.textContent = title;

    const p = document.createElement('p');
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-outline';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'btn-danger' : 'btn-outline';
    confirmBtn.textContent = confirmText;

    function close(value) {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      resolve(value);
    }

    function onKeyDown(ev) {
      if (ev.key === 'Escape') {
        close(false);
      }
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        close(false);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    modal.appendChild(h3);
    modal.appendChild(p);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(() => {
      confirmBtn.focus();
    }, 60);
  });
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

async function toggleRoomActive(roomId, isActive) {
  return apiRequest(`${API_URL}/rooms/${encodeURIComponent(roomId)}/professor-toggle-active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: !!isActive }),
  });
}

async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    const data = await apiRequest(`${API_URL}/rooms/by-professor`);
    const rooms = unwrapResult(data);

    roomsList.innerHTML = '';

    if (!rooms.length) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
      const roomId = String(room?.id || '').trim();
      const active = isActiveRoom(room);

      const li = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = room?.name || 'Sala';

      const status = document.createElement('small');
      status.className = 'mk-muted';
      status.textContent = `Status: ${statusText(room)}`;

      const acessar = document.createElement('button');
      acessar.textContent = 'Acessar';
      acessar.disabled = !active;
      acessar.title = active
        ? 'Acessar sala'
        : 'Sala desativada. Ative a sala para acessá-la.';

      acessar.onclick = async () => {
        if (!roomId || !active) return;

        try {
          await apiRequest(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);

          window.location.href = `sala-professor.html?roomId=${encodeURIComponent(roomId)}`;
        } catch {
          notify(
            'warn',
            'Sala indisponível',
            'Esta sala não existe mais ou foi removida.'
          );

          await carregarSalas();
        }
      };

      const toggle = document.createElement('button');
      toggle.textContent = active ? 'Desativar' : 'Ativar';

      toggle.onclick = async () => {
        if (!roomId) return;

        const ok = await confirmDialog({
          title: active ? 'Desativar sala' : 'Ativar sala',
          message: active
            ? `Deseja desativar a sala "${room?.name || 'Sala'}"? Ela continuará registrada, mas deixará de contar como sala ativa.`
            : `Deseja ativar a sala "${room?.name || 'Sala'}"? Se você já tiver 10 salas ativas, a ativação será bloqueada.`,
          confirmText: active ? 'Desativar' : 'Ativar',
          cancelText: 'Cancelar',
          danger: active,
        });

        if (!ok) return;

        disable(toggle, true);

        try {
          await toggleRoomActive(roomId, !active);

          notify(
            'success',
            'Sala atualizada',
            active ? 'A sala foi desativada.' : 'A sala foi ativada.'
          );

          await carregarSalas();
        } catch (e) {
          notify('error', 'Erro', e.message);
        } finally {
          disable(toggle, false);
        }
      };

      const excluir = document.createElement('button');
      excluir.textContent = 'Excluir';

      excluir.onclick = async () => {
        if (!roomId) return;

        const ok = await confirmDialog({
          title: 'Excluir sala',
          message: `Deseja excluir a sala "${room?.name || 'Sala'}"? Essa ação removerá a sala e seus vínculos.`,
          confirmText: 'Excluir',
          cancelText: 'Cancelar',
          danger: true,
        });

        if (!ok) return;

        disable(excluir, true);

        try {
          await apiRequest(`${API_URL}/rooms/${encodeURIComponent(roomId)}`, {
            method: 'DELETE',
          });

          notify('success', 'Sala excluída', 'A sala foi removida.');
          await carregarSalas();
        } catch (e) {
          const msg = String(e.message || '').toLowerCase();

          if (msg.includes('não encontrada') || msg.includes('not found')) {
            notify(
              'info',
              'Sala já removida',
              'Esta sala já não existe mais.'
            );
            await carregarSalas();
            return;
          }

          notify('error', 'Erro', e.message);
        } finally {
          disable(excluir, false);
        }
      };

      li.appendChild(name);
      li.appendChild(document.createElement('br'));
      li.appendChild(status);
      li.appendChild(document.createElement('br'));
      li.appendChild(acessar);
      li.appendChild(toggle);
      li.appendChild(excluir);

      roomsList.appendChild(li);
    });
  } catch (e) {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
    notify('error', 'Erro', e.message);
  }
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

carregarSalas();

