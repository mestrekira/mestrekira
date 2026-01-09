import { API_URL } from './config.js';

const studentId = localStorage.getItem('studentId');

if (!studentId) {
  window.location.href = 'login-aluno.html';
}

const status = document.getElementById('status');

document.getElementById('joinBtn').addEventListener('click', async () => {
  const code = document.getElementById('roomCode').value.trim();

  if (!code) {
    alert('Informe o código da sala.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId }),
    });

    if (!response.ok) throw new Error();

    const data = await response.json();

    status.textContent = 'Entrada realizada com sucesso!';
    window.location.href = `sala-aluno.html?roomId=${data.roomId}`;

  } catch {
    status.textContent = 'Código inválido ou erro ao entrar na sala.';
  }
});
