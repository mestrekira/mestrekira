import { API_URL } from './config.js';

const form = document.getElementById('enrollForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const roomCode = document.getElementById('roomCode').value;
  const userId = document.getElementById('userId').value;

  try {
    const response = await fetch(`${API_URL}/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roomCode, userId })
    });

    if (!response.ok) {
      throw new Error('Erro na matrícula');
    }

    alert('Matrícula realizada com sucesso!');
    form.reset();

  } catch (error) {
    console.error(error);
    alert('Não foi possível realizar a matrícula.');
  }
});
