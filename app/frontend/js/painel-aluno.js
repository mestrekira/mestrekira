import { toast } from './ui-feedback.js';
import { requireStudentSession, authFetch } from './auth.js';

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

// -------------------- Sessão --------------------
function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

const session = requireStudentSession({ redirectTo: 'login-aluno.html' });

function resolveStudentId(sessionValue) {
  if (typeof sessionValue === 'string' || typeof sessionValue === 'number') {
    return String(sessionValue).trim();
  }

  if (sessionValue && typeof sessionValue === 'object') {
    const direct = String(
      sessionValue.studentId ||
        sessionValue.id ||
        sessionValue.userId ||
        sessionValue.user?.id ||
        ''
    ).trim();

    if (direct) return direct;
  }

  const user = safeJsonParse(localStorage.getItem('user'));
  const lsStudentId = String(localStorage.getItem('studentId') || '').trim();
  const userId = String(user?.id || '').trim();

  return lsStudentId || userId || '';
}

const studentId = resolveStudentId(session);

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

function normalizeRoom(item) {
  const room =
    item?.room ||
    item?.sala ||
    item?.classroom ||
    item?.enrollment?.room ||
    item?.matricula?.room ||
    null;

  const id = String(
    room?.id ||
      room?.roomId ||
      item?.roomId ||
      item?.room_id ||
      item?.id ||
      ''
  ).trim();

  const name = String(
    room?.name ||
      room?.roomName ||
      room?.title ||
      item?.roomName ||
      item?.room_name ||
      item?.name ||
      item?.title ||
      'Sala'
  ).trim();

  return { id, name };
}

function extractRooms(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.rooms)
      ? raw.rooms
      : Array.isArray(raw?.enrollments)
        ? raw.enrollments
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

  return arr
    .map(normalizeRoom)
    .filter((r) => !!r.id)
    .filter((r, index, self) => self.findIndex((x) => x.id === r.id) === index);
}

function goToRoom(roomId) {
  window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(roomId)}`;
}

// -------------------- Carregar salas --------------------
async function fetchStudentRooms() {
  const attempts = [];

  if (studentId) {
    attempts.push(`/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`);
  }

  attempts.push('/enrollments/by-student');

  let lastRaw = null;

  for (const path of attempts) {
    try {
      const raw = await authFetch(
        path,
        { method: 'GET' },
        { redirectTo: 'login-aluno.html' }
      );

      console.log('[painel-aluno] tentativa =>', path, raw);

      lastRaw = raw;
      const rooms = extractRooms(raw);

      if (rooms.length > 0) {
        return rooms;
      }
    } catch (err) {
      console.error('[painel-aluno] erro na tentativa', path, err);
      lastRaw = null;
    }
  }

  console.log('[painel-aluno] nenhuma sala encontrada. studentId=', studentId, 'lastRaw=', lastRaw);
  return [];
}

async function carregarMinhasSalas() {
  if (!roomsList) return;

  renderEmpty('Carregando...');

  try {
    const rooms = await fetchStudentRooms();

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

      li.addEventListener('click', () => goToRoom(room.id));

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

carregarMinhasSalas();
