import { API_URL } from './config.js';

const status = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');

enterBtn.addEventListener('click', async () => {
  const code = document.getElementById('code').value.trim();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!code || !name || !email) {
    status.textContent = 'Preencha todos os campos.';
    return;
  }

  // 🔹 Gera ou reutiliza studentId
  let studentId = localStorage.getItem('studentId');

  if (!studentId) {
    studentId = crypto.randomUUID();
    localStorage.setItem('studentId', studentId);
    localStorage.setItem('studentName', name);
    localStorage.setItem('studentEmail', email);
  }

  try {
    const response = await fetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId }),
    });

    if (!response.ok) {
      throw new Error('Falha ao entrar na sala');
    }

    const data = await response.json();

    // 🔹 Redireciona para o painel do aluno com roomId
    window.location.href = `painel-aluno.html?roomId=${data.roomId}`;

  } catch (e) {
    console.error(e);
    status.textContent = 'Erro ao entrar na sala. Verifique o código.';
  }
});
