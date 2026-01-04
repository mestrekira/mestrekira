import { API_URL } from './config.js';

const criteria = [
  'Competência 1 – Norma padrão',
  'Competência 2 – Compreensão do tema',
  'Competência 3 – Argumentação',
  'Competência 4 – Coesão',
  'Competência 5 – Proposta de intervenção'
];

const container = document.getElementById('criteria');

criteria.forEach((c, i) => {
  const div = document.createElement('div');
  div.innerHTML = `
    <label>${c}</label>
    <input type="number" min="0" max="200" step="40" id="c${i}">
  `;
  container.appendChild(div);
});

document.getElementById('saveCorrection').addEventListener('click', async () => {
  const params = new URLSearchParams(window.location.search);
  const essayId = params.get('essayId');

  const scores = criteria.map((_, i) =>
    Number(document.getElementById(`c${i}`).value || 0)
  );

  const feedback = document.getElementById('feedback').value;

  await fetch(`${API_URL}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      essayId,
      scores,
      feedback
    })
  });

  alert('Correção salva.');
});
