import { API_URL } from './config.js';

const professorId = localStorage.getItem('professorId');

if (!professorId) {
  window.location.href = 'login-professor.html';
}

const roomsList = document.getElementById('roomsList');


async function carregarSalas() {
  const response = await fetch(`${API_URL}/rooms/by-professor?professorId=${professorId}`);
  const rooms = await response.json();

  roomsList.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.textContent = room.name;

    const btn = document.createElement('button');
    btn.textContent = 'Acessar';
    btn.onclick = () => {
     window.location.href = `sala-professor.html?roomId=${room.id}`;
    };

    li.appendChild(btn);
    roomsList.appendChild(li);

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

li.appendChild(delBtn);

  });
}


document.getElementById('createRoomBtn').addEventListener('click', async () => {
  const name = document.getElementById('roomName').value;

  if (!name) return;

  await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, professorId })
  });

  document.getElementById('roomName').value = '';
  carregarSalas();
});


document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('professorId');
  window.location.href = 'login-professor.html';
});

carregarSalas();
