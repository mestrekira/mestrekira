import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');

async function carregarDados() {
  const response = await fetch(`${API_URL}/users/${userId}/scores`);
  const data = await response.json();

  const labels = data.map((_, i) => `Redação ${i + 1}`);
  const scores = data.map(d => d.total);

  const ctx = document.getElementById('chart');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nota ENEM',
        data: scores,
        fill: false
      }]
    }
  });
}

carregarDados();
