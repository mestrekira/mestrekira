import { API_URL } from './config.js';

const professorId = localStorage.getItem('professorId');

if (!professorId) {
  window.location.href = 'login-professor.html';
}

const roomsList = document.getElementById('roomsList');

async function carregarSalas() {
  try {
    const response = await fetch(`${API_URL}/rooms/by-professor?professorId=${professorId}`);
    if (!response.ok) throw new Error();

    const rooms = await response.json();

    roomsList.innerHTML = '';

    if (!rooms || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não criou nenhuma sala.</li>';
      return;
    }

    rooms.forEach(room => {
      const li = document.createElement('li');
      li.textContent = room.name + ' ';

      // ✅ Acessar
      const btn = document.createElement('button');
      btn.textContent = 'Acessar';
      btn.onclick = () => {
        window.location.href = `sala-professor.html?roomId=${room.id}`;
      };

      // ✅ Excluir
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

document.getElementById('createRoomBtn').addEventListener('click', async () => {
  const name = document.getElementById('roomName').value.trim();
  if (!name) return;

  try {
    const response = await fetch(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, professorId })
    });

    if (!response.ok) throw new Error();

    document.getElementById('roomName').value = '';
    carregarSalas();

  } catch {
    alert('Erro ao criar sala.');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('professorId');
  window.location.href = 'login-professor.html';
});

carregarSalas();
