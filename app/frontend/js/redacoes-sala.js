import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

async function carregarRedacoes() {
  const response = await fetch(`${API_URL}/essays/room/${roomId}`);
  const essays = await response.json();

  const ul = document.getElementById('essayList');
  ul.innerHTML = '';

  essays.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${e.userId}</strong>
      <button onclick="location.href='corrigir.html?essayId=${e.id}'">
        Corrigir
      </button>
    `;
    ul.appendChild(li);
  });
}

carregarRedacoes();
