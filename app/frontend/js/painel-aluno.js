import { API_URL } from './config.js';

const studentId = localStorage.getItem('studentId');

if (!studentId) {
  window.location.href = 'login-aluno.html';
}

// ELEMENTOS
const roomsList = document.getElementById('roomsList');
const logoutBtn = document.getElementById('logoutBtn');

// 🔹 CARREGAR SALAS DO ALUNO
async function carregarSalas() {
  try {
    const response = await fetch(`${API_URL}/enrollments/by-student?studentId=${studentId}`);
    if (!response.ok) throw new Error();

    const rooms = await response.json();
    roomsList.innerHTML = '';

    if (rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não entrou em nenhuma sala.</li>';
      return;
    }

    rooms.forEach(room => {
      const li = document.createElement('li');
      li.textContent = room.name;

      const btn = document.createElement('button');
      btn.textContent = 'Entrar';
      btn.onclick = () => {
        window.location.href = `sala-aluno.html?roomId=${room.id}`;
      };

      li.appendChild(btn);
      roomsList.appendChild(li);
    });

  } catch {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
  }
}

// 🔹 LOGOUT
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('studentId');
  window.location.href = 'login-aluno.html';
});

// 🔹 INIT
carregarSalas();
