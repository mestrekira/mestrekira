import { API_URL } from './config.js';

const $ = (id) => document.getElementById(id);

const statusEl = $('status');
const inviteEmailEl = $('inviteEmail');
const btnInvite = $('btnInvite');
const inviteOut = $('inviteOut');

const roomNameEl = $('roomName');
const teacherEmailEl = $('teacherEmail');
const btnCreateRoom = $('btnCreateRoom');
const roomStatus = $('roomStatus');

const btnRefresh = $('btnRefresh');
const roomsList = $('roomsList');

function token() {
  return localStorage.getItem('token') || '';
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

async function api(path, options = {}) {
  const t = token();
  if (!t) throw new Error('Sem token');

  const r = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${t}`,
      ...(options.headers || {}),
    },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || 'Erro');
  return data;
}

async function createInvite() {
  const teacherEmail = String(inviteEmailEl?.value || '').trim();
  if (!teacherEmail) return;

  btnInvite.disabled = true;
  inviteOut.textContent = 'Gerando...';

  try {
    const data = await api('/school-teacher/invite', {
      method: 'POST',
      body: JSON.stringify({ teacherEmail }),
    });

    inviteOut.textContent =
      `Convite gerado:\n` +
      `Email: ${data.teacherEmail}\n` +
      `Código: ${data.code}\n` +
      `Expira: ${new Date(data.expiresAt).toLocaleString('pt-BR')}\n\n` +
      `Professor deve usar /school-teacher/accept (ou sua tela de aceitar convite).`;
  } catch (e) {
    inviteOut.textContent = String(e?.message || 'Erro');
  } finally {
    btnInvite.disabled = false;
  }
}

async function createRoom() {
  const roomName = String(roomNameEl?.value || '').trim();
  const teacherEmail = String(teacherEmailEl?.value || '').trim();

  if (!roomName || !teacherEmail) {
    roomStatus.textContent = 'Preencha nome da sala e e-mail do professor.';
    return;
  }

  btnCreateRoom.disabled = true;
  roomStatus.textContent = 'Salvando...';

  try {
    const data = await api('/schools/rooms', {
      method: 'POST',
      body: JSON.stringify({ roomName, teacherEmail }),
    });

    roomStatus.textContent = `OK: Sala criada (${data.room.name})`;
    await loadRooms();
  } catch (e) {
    roomStatus.textContent = String(e?.message || 'Erro');
  } finally {
    btnCreateRoom.disabled = false;
  }
}

async function loadRooms() {
  setStatus('Carregando salas...');
  roomsList.innerHTML = '';

  try {
    const rooms = await api('/schools/rooms', { method: 'GET' });

    if (!rooms.length) {
      roomsList.innerHTML = '<p class="muted">Nenhuma sala cadastrada.</p>';
      setStatus('');
      return;
    }

    const frag = document.createDocumentFragment();

    for (const r of rooms) {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <b>${r.name}</b><br/>
        Código: <span>${r.code}</span><br/>
        Professor: ${r.teacherName || ''} (${r.teacherEmail || ''})<br/>
        <button data-room="${r.id}">Ver média</button>
        <span class="muted" id="avg-${r.id}"></span>
      `;

      div.querySelector('button')?.addEventListener('click', async () => {
        const out = div.querySelector(`#avg-${r.id}`);
        out.textContent = ' ...';
        try {
          const data = await api(`/schools/rooms/avg?roomId=${encodeURIComponent(r.id)}`, { method: 'GET' });
          out.textContent = ` Média: ${data.average == null ? '—' : data.average} (n=${data.count})`;
        } catch (e) {
          out.textContent = ` Erro`;
        }
      });

      frag.appendChild(div);
    }

    roomsList.appendChild(frag);
    setStatus('');
  } catch (e) {
    setStatus(String(e?.message || 'Erro'));
  }
}

btnInvite?.addEventListener('click', createInvite);
btnCreateRoom?.addEventListener('click', createRoom);
btnRefresh?.addEventListener('click', loadRooms);

loadRooms().catch(() => {});
