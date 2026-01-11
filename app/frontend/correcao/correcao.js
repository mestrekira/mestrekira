import { API_URL } from '../js/config.js';

const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');

if (!taskId) {
  alert('Tarefa inválida.');
  throw new Error('taskId ausente');
}

const listEl = document.getElementById('essaysList');

async function carregarRedacoes() {
  try {
    const response = await fetch(`${API_URL}/essays/by-task?taskId=${taskId}`);
    if (!response.ok) throw new Error();

    const essays = await response.json();
    listEl.innerHTML = '';

    if (essays.length === 0) {
      listEl.innerHTML = '<li>Nenhuma redação enviada.</li>';
      return;
    }

    essays.forEach(essay => {
      const li = document.createElement('li');

      li.textContent = `Aluno: ${essay.studentName || essay.studentId}`;

      const btn = document.createElement('button');
      btn.textContent = 'Corrigir';
      btn.onclick = () => {
        window.location.href = `corrigir.html?essayId=${essay.id}`;
      };

      li.appendChild(btn);
      listEl.appendChild(li);
    });

  } catch {
    listEl.innerHTML = '<li>Erro ao carregar redações.</li>';
  }
}

carregarRedacoes();
