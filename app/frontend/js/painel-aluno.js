import { API_URL } from './config.js';

const roomsList = document.getElementById('roomsList');

// fonte da verdade do aluno
const studentId = localStorage.getItem('studentId');

// se não estiver logado como aluno, manda pro login-aluno
if (!studentId || studentId === 'undefined' || studentId === 'null') {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente');
}

async function carregarSalas() {
  if (!roomsList) return;

  roomsList.innerHTML = '<li>Carregando...</li>';

  try {
    const res = await fetch(
      `${API_URL}/enrollments/by-student?studentId=${encodeURIComponent(studentId)}`
    );

    if (!res.ok) throw new Error('Falha ao buscar salas');

    const rooms = await res.json();
    roomsList.innerHTML = '';

    if (!Array.isArray(rooms) || rooms.length === 0) {
      roomsList.innerHTML = '<li>Você ainda não entrou em nenhuma sala.</li>';
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement('li');
      li.textContent = room.name || 'Sala';

      const btn = document.createElement('button');
      btn.textContent = 'Entrar';
      btn.onclick = () => {
        window.location.href = `sala-aluno.html?roomId=${room.id}`;
      };

      li.appendChild(btn);
      roomsList.appendChild(li);
    });
  } catch (e) {
    roomsList.innerHTML = '<li>Erro ao carregar salas.</li>';
    console.error(e);
  }
}

carregarSalas();
