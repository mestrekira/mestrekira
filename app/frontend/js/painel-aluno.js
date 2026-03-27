import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';
import { requireStudentSession, authFetch, readErrorMessage } from './auth.js';

// -------------------- Toast helper --------------------
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

// -------------------- Guard --------------------
const studentId = requireStudentSession({ redirectTo: 'login-aluno.html' });

// -------------------- Elementos --------------------
const roomsList = document.getElementById('roomsList');

// -------------------- Utils --------------------
function renderEmpty(msg) {
  if (!roomsList) return;
  roomsList.innerHTML = '';
  const li = document.createElement('li');
  li.textContent = msg || '';
  roomsList.appendChild(li);
}

function normalizeRoom(r) {
  const nestedRoom = r?.room || r?.sala || null;

  const id = String(
    nestedRoom?.id ||
      r?.roomId ||
      r?.room_id ||
      r?.id ||
      ''
  ).trim();

  const name = String(
    nestedRoom?.name ||
      r?.roomName ||
      r?.room_name ||
      r?.name ||
      'Sala'
  ).trim();

  return { id, name };
}

async function jsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function goToRoom(roomId) {
  window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(roomId)}`;
}

// -------------------- Carregar salas --------------------
async function carregarMinhasSalas() {
  if (!roomsList) return;

  renderEmpty('Carregando...');

  try {
    const res = await authFetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    const raw = await jsonSafe(res);
    console.log('[painel-aluno] raw =>', raw);

    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.rooms)
        ? raw.rooms
        : Array.isArray(raw?.enrollments)
          ? raw.enrollments
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

    const rooms = arr
      .map(normalizeRoom)
      .filter((r) => !!r.id)
      .filter((r, index, self) => self.findIndex((x) => x.id === r.id) === index);

    roomsList.innerHTML = '';

    if (rooms.length === 0) {
      renderEmpty('Você ainda não está em nenhuma sala.');
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.title = 'Clique para abrir a sala';

      const nameText = document.createElement('span');
      nameText.textContent = `${room.name} `;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Abrir';

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        goToRoom(room.id);
      });

      li.addEventListener('click', () => {
        goToRoom(room.id);
      });

      li.appendChild(nameText);
      li.appendChild(btn);
      roomsList.appendChild(li);
    });
  } catch (err) {
    if (!String(err?.message || '').startsWith('AUTH_')) {
      console.error(err);
      renderEmpty('Erro ao carregar suas salas.');
      notify(
        'error',
        'Erro',
        'Não foi possível carregar suas salas agora. Tente novamente.'
      );
    }
  }
}

// -------------------- INIT --------------------
carregarMinhasSalas();
