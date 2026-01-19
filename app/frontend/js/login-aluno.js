import { API_URL } from './config.js';

function normRole(role) {
  return String(role || '').trim().toUpperCase(); // "PROFESSOR" | "STUDENT"
}

async function fazerLogin() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const errorEl = document.getElementById('error');

  const email = emailEl?.value?.trim() || '';
  const password = passEl?.value || '';

  if (errorEl) errorEl.textContent = '';

  if (!email || !password) {
    if (errorEl) errorEl.textContent = 'Preencha e-mail e senha.';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    // Mesmo quando for erro de credencial, seu backend pode responder 200 com { error }
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (errorEl) errorEl.textContent = 'Erro ao fazer login.';
      return;
    }

    if (!data || data.error) {
      if (errorEl) errorEl.textContent = data?.error || 'Usuário ou senha inválidos.';
      return;
    }

    if (!data.id) {
      if (errorEl) errorEl.textContent = 'Resposta inválida do servidor.';
      return;
    }

    const role = normRole(data.role);

    // 🔒 evita ficar com os dois IDs no localStorage
    localStorage.removeItem('professorId');
    localStorage.removeItem('studentId');

    if (role === 'PROFESSOR') {
      localStorage.setItem('professorId', data.id);
      window.location.href = 'professor-salas.html';
      return;
    }

    // padrão: aluno
    localStorage.setItem('studentId', data.id);
    window.location.href = 'painel-aluno.html';
  } catch {
    if (errorEl) errorEl.textContent = 'Erro ao fazer login. Tente novamente.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  const pass = document.getElementById('password');

  if (btn) btn.addEventListener('click', fazerLogin);

  // Enter para login
  if (pass) {
    pass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }
});
