// painel-aluno.js (padronizado com auth.js)
// - usa requireStudentSession + authFetch + readErrorMessage do auth.js
// - lista salas do aluno e abre sala-aluno.html?roomId=...

import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

import {
  requireStudentSession,
  getStudentIdCompat,
  authFetch,
  readErrorMessage,
} from './auth.js';

// -------------------- UI helpers --------------------
function notify(type, title, message, duration) {
  try {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
    });
  } catch {
    if (type === 'error') console.error(title, message);
  }
}

// -------------------- Guard --------------------
requireStudentSession({ redirectTo: 'login-aluno.html' });
const studentId = getStudentIdCompat();

// -------------------- Página --------------------
const roomsList = document.getElementById('roomsList');

function renderEmpty(msg) {
  if (!roomsList) return;
  roomsList.innerHTML = `<li>${msg}</li>`;
}

function normalizeRoom(r) {
  const id = String(r?.id || r?.roomId || '').trim();
  const name = String(r?.name || r?.roomName || 'Sala').trim();
  return { id, name };
}

async function carregarMinhasSalas() {
  if (!roomsList) return;

  renderEmpty('Carregando...');

  try {
    const res = await authFetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`,
      {},
      { redirectTo: 'login-aluno.html' },
    );

    if (!res.ok) {
      const msg = await readErrorMessage(res, `HTTP ${res.status}`);
      throw new Error(msg);
    }

    const raw = await res.json().catch(() => null);
    const arr = Array.isArray(raw) ? raw : [];

    const rooms = arr.map(normalizeRoom).filter((r) => !!r.id);

    roomsList.innerHTML = '';

    if (rooms.length === 0) {
      renderEmpty('Você ainda não está em nenhuma sala.');
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');

      const nameText = document.createElement('span');
      nameText.textContent = room.name + ' ';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Abrir';
      btn.addEventListener('click', () => {
        window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(room.id)}`;
      });

      li.appendChild(nameText);
      li.appendChild(btn);
      roomsList.appendChild(li);
    });
  } catch (err) {
    // se foi AUTH_401/403, authFetch já redireciona
    if (!String(err?.message || '').startsWith('AUTH_')) {
      console.error(err);
      renderEmpty('Erro ao carregar suas salas.');
      notify('error', 'Erro', 'Não foi possível carregar suas salas agora. Tente novamente.');
    }
  }
}

carregarMinhasSalas();
