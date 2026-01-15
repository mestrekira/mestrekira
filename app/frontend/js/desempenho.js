import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const studentId = localStorage.getItem('studentId');

if (!studentId) {
  window.location.href = 'login-aluno.html';
  throw new Error('studentId ausente');
}

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'painel-aluno.html';
  throw new Error('roomId ausente');
}

const roomNameEl = document.getElementById('roomName');
const essaysList = document.getElementById('essaysList');
const status = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

function mean(nums) {
  const v = nums.filter(n => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

async function carregarSala() {
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}`);
    if (!res.ok) throw new Error();
    const room = await res.json();
    roomNameEl.textContent = room.name || 'Sala';
  } catch {
    roomNameEl.textContent = 'Sala';
  }
}

async function carregarDesempenho() {
  try {
    status.textContent = 'Carregando...';

    const res = await fetch(
      `${API_URL}/essays/performance/by-room-for-student?roomId=${roomId}&studentId=${studentId}`
    );

    if (!res.ok) throw new Error();

    const essays = await res.json();
    essaysList.innerHTML = '';

    if (!Array.isArray(essays) || essays.length === 0) {
      status.textContent = 'Nenhuma redação enviada nesta sala ainda.';
      avgTotal.textContent = '—';
      avgC1.textContent = '—';
      avgC2.textContent = '—';
      avgC3.textContent = '—';
      avgC4.textContent = '—';
      avgC5.textContent = '—';
      return;
    }

    // médias (somente redações corrigidas)
    const corrected = essays.filter(e => e.score !== null && e.score !== undefined);

    avgTotal.textContent = mean(corrected.map(e => e.score)) ?? '—';
    avgC1.textContent = mean(corrected.map(e => e.c1)) ?? '—';
    avgC2.textContent = mean(corrected.map(e => e.c2)) ?? '—';
    avgC3.textContent = mean(corrected.map(e => e.c3)) ?? '—';
    avgC4.textContent = mean(corrected.map(e => e.c4)) ?? '—';
    avgC5.textContent = mean(corrected.map(e => e.c5)) ?? '—';

    // lista
    essays.forEach(e => {
      const li = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = e.taskTitle || 'Tarefa';

      const line = document.createElement('div');
      const nota = (e.score !== null && e.score !== undefined) ? `Nota: ${e.score}` : 'Sem correção';
      line.textContent = nota;

      const btn = document.createElement('button');
      btn.textContent = 'Ver redação/feedback';
      btn.onclick = () => {
        window.location.href = `feedback-aluno.html?essayId=${e.id}`;
      };

      li.appendChild(title);
      li.appendChild(document.createElement('br'));
      li.appendChild(line);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);

      essaysList.appendChild(li);
    });

    status.textContent = '';
  } catch {
    status.textContent = 'Erro ao carregar desempenho.';
    essaysList.innerHTML = '';
  }
}

// INIT
carregarSala();
carregarDesempenho();
