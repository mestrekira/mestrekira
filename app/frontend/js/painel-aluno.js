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
  const id = String(r?.id || r?.roomId || '').trim();
  const name = String(r?.name || r?.roomName || 'Sala').trim();
  return { id, name };
}

function goToRoom(roomId) {
  window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(roomId)}`;
}

// -------------------- Carregar salas --------------------
async function carregarMinhasSalas() {
  if (!roomsList) return;

  renderEmpty('Carregando...');

  try {
    const raw = await authFetch(
      `/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`,
      { method: 'GET' },
      { redirectTo: 'login-aluno.html' }
    );

    const arr = Array.isArray(raw) ? raw : raw?.rooms || raw?.enrollments || [];
    const rooms = arr.map(normalizeRoom).filter((r) => !!r.id);

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
