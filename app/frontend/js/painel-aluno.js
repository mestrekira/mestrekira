import { API_URL } from './config.js';

const roomsList = document.getElementById('roomsList');
const logoutBtn = document.getElementById('logoutBtn');

// studentId é a “fonte da verdade”
const studentId = localStorage.getItem('studentId');

// se não estiver logado como aluno, manda pro login do aluno
if (!studentId) {
  window.location.href = 'login-aluno.html';
}

// 🔹 CARREGAR SALAS DO ALUNO
async function carregarSalas() {
  if (!roomsList) return;

  try {
    const response = await fetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`
    );

    if (!response.ok) throw new Error();

    const rooms = await response.json();
    roomsList.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não entrou em nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
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
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('studentId');
    window.location.href = 'login-aluno.html';
  });
}

// INIT
carregarSalas();
