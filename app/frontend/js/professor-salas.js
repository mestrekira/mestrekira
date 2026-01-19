import { API_URL } from './config.js';

const professorId = localStorage.getItem('professorId');

if (!professorId || professorId === 'undefined' || professorId === 'null') {
  window.location.href = 'login-professor.html';
  throw new Error('professorId ausente');
}

const roomsList = document.getElementById('roomsList');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameInput = document.getElementById('roomName');

async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    const response = await fetch(
      `${API_URL}/rooms/by-professor?professorId=${encodeURIComponent(professorId)}`
    );
    if (!response.ok) throw new Error();

    const rooms = await response.json();
    roomsList.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');
      li.textContent = room.name + ' ';

      const btn = document.createElement('button');
      btn.textContent = 'Acessar';
      btn.onclick = () => {
        window.location.href = `sala-professor.html?roomId=${room.id}`;
      };

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.onclick = async () => {
        const ok = confirm(`Excluir a sala "${room.name}"?`);
        if (!ok) return;

        const res = await fetch(`${API_URL}/rooms/${room.id}`, { method: 'DELETE' });
        if (!res.ok) {
          alert('Erro ao excluir sala.');
          return;
        }

        carregarSalas();
      };

      li.appendChild(btn);
      li.appendChild(delBtn);
      roomsList.appendChild(li);
    });

  } catch {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
  }
}

if (createRoomBtn) {
  createRoomBtn.addEventListener('click', async () => {
    const name = roomNameInput?.value?.trim() || '';
    if (!name) {
      alert('Informe o nome da sala.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, professorId }),
      });

      if (!response.ok) throw new Error();

      if (roomNameInput) roomNameInput.value = '';
      carregarSalas();
    } catch {
      alert('Erro ao criar sala.');
    }
  });
}

carregarSalas();
