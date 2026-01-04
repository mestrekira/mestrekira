import { API_URL } from './config.js';

const btn = document.getElementById('loadBtn');
const ul = document.getElementById('myRooms');

btn.addEventListener('click', async () => {
  const userId = document.getElementById('userId').value;

  if (!userId) {
    alert('Informe o ID');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/${userId}/rooms`);

    if (!response.ok) {
      throw new Error('Erro ao buscar salas');
    }

    const salas = await response.json();
    ul.innerHTML = '';

    if (salas.length === 0) {
      ul.innerHTML = '<li>Nenhuma sala encontrada.</li>';
      return;
    }

    salas.forEach(sala => {
      const li = document.createElement('li');
      li.textContent = sala.name;
      ul.appendChild(li);
    });

  } catch (error) {
    console.error(error);
    alert('Erro ao carregar salas.');
  }
});
