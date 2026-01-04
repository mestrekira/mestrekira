import { API_URL } from './config.js';

async function carregarSalas() {
  try {
    const response = await fetch(`${API_URL}/rooms`);

    if (!response.ok) {
      throw new Error('Erro ao carregar salas');
    }

    const salas = await response.json();
    const ul = document.getElementById('rooms');

    ul.innerHTML = '';

    salas.forEach(sala => {
      const li = document.createElement('li');
      li.textContent = sala.name;
      ul.appendChild(li);
    });

  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar as salas.');
  }
}

carregarSalas();
