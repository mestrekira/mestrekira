import { API_URL } from './config.js';

async function fazerLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Preencha e-mail e senha.';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      errorEl.textContent = 'Login inválido.';
      return;
    }

    const user = await res.json();

    // segurança básica
    if (!user?.id) {
      errorEl.textContent = 'Resposta inválida do servidor.';
      return;
    }

    // Se logar professor aqui por acidente, redireciona certo
    if (user.role === 'professor') {
      localStorage.setItem('professorId', user.id);
      window.location.href = 'professor-salas.html';
      return;
    }

    // Fluxo aluno
    localStorage.setItem('studentId', user.id);
    window.location.href = 'painel-aluno.html';
  } catch {
    errorEl.textContent = 'Erro ao fazer login. Tente novamente.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', fazerLogin);
  document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLogin();
  });
});
