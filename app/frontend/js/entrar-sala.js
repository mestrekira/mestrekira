import { API_URL } from './config.js';

const status = document.getElementById('status');

document.getElementById('enterBtn').addEventListener('click', async () => {
  const code = document.getElementById('code').value.trim();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!code || !name || !email || !password) {
    status.textContent = 'Preencha todos os campos.';
    return;
  }

  try {
    // 1) cria aluno (se já existir, o backend pode retornar erro — ignoramos)
    await fetch(`${API_URL}/users/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    }).catch(() => {});

    // 2) login
    const loginRes = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!loginRes.ok) throw new Error('Login falhou');

    const user = await loginRes.json();
    localStorage.setItem('studentId', user.id);

    // 3) matrícula por código
    const joinRes = await fetch(`${API_URL}/enrollments/join-by-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: user.id, code })
    });
    if (!joinRes.ok) throw new Error('Matrícula falhou');

    // 4) vai para o painel
    window.location.href = 'painel-aluno.html';

  } catch (e) {
    status.textContent = 'Erro ao entrar na sala.';
  }
});
