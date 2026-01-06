import { API_URL } from './config.js';

const status = document.getElementById('status');


document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('emailLogin').value;
  const password = document.getElementById('passwordLogin').value;

  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error();

    const data = await response.json();

    localStorage.setItem('professorId', data.id);
    window.location.href = 'professor-salas.html';

  } catch {
    status.textContent = 'Erro ao fazer login.';
  }
});


document.getElementById('registerBtn').addEventListener('click', async () => {
  const name = document.getElementById('nameRegister').value;
  const email = document.getElementById('emailRegister').value;
  const password = document.getElementById('passwordRegister').value;

  if (password.length < 8) {
    status.textContent = 'A senha deve ter no mínimo 8 caracteres.';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/professor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Cadastro realizado. Faça login.';

  } catch {
    status.textContent = 'Erro ao cadastrar professor.';
  }
});
