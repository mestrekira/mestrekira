import { API_URL } from './config.js';

const studentId = localStorage.getItem('studentId');
const status = document.getElementById('status');
const input = document.getElementById('roomCode');

if (!studentId) {
  window.location.href = 'login-aluno.html';
}

document.getElementById('enterRoomBtn').addEventListener('click', async () => {
  const code = input.value.trim().toUpperCase();

  if (!code) {
    status.textContent = 'Informe o código da sala.';
    return;
  }

  try {
    
    const roomResponse = await fetch(
      `${API_URL}/rooms/by-code?code=${code}`
    );

    if (!roomResponse.ok) throw new Error('Código inválido');

    const room = await roomResponse.json();

  
    const enrollResponse = await fetch(`${API_URL}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        studentId,
      }),
    });

    if (!enrollResponse.ok) throw new Error('Erro ao matricular');

    status.textContent = 'Entrada realizada com sucesso!';

  
    setTimeout(() => {
      window.location.href = 'painel-aluno.html';
    }, 800);

  } catch (err) {
    status.textContent = 'Código inválido ou aluno já matriculado.';
  }
});
