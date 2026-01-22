import { API_URL } from './config.js';

const studentId = localStorage.getItem('studentId');

if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.replace('login-aluno.html');
  throw new Error('studentId ausente/inválido');
}

const roomsList = document.getElementById('roomsList');

async function carregarMinhasSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    const res = await fetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rooms = await res.json();
    roomsList.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não está em nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');

      const name = room?.name || 'Sala';
      li.appendChild(document.createTextNode(name + ' '));

      const btn = document.createElement('button');
      btn.textContent = 'Abrir';
      btn.addEventListener('click', () => {
        window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(room.id)}`;
      });

      li.appendChild(btn);
      roomsList.appendChild(li);
    });
  } catch {
    roomsList.innerHTML = '<li>Erro ao carregar suas salas.</li>';
  }
}

carregarMinhasSalas();
