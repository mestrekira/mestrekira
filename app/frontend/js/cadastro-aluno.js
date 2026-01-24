import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const btn = document.getElementById('signupBtn');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name = nameEl?.value?.trim() || '';
    const email = emailEl?.value?.trim() || '';
    const password = passEl?.value || '';

    setStatus('');

    if (!name || !email || !password) {
      setStatus('Preencha nome, e-mail e senha.');
      return;
    }

    if (password.length < 8) {
      setStatus('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    btn.disabled = true;
    setStatus('Criando conta...');

    try {
      const res = await fetch(`${API_URL}/users/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(data?.message || 'Erro ao criar conta.');
        btn.disabled = false;
        return;
      }

      setStatus('Conta criada! Redirecionando para login...');
      setTimeout(() => window.location.replace('login-aluno.html'), 600);
    } catch {
      setStatus('Erro ao criar conta. Tente novamente.');
      btn.disabled = false;
    }
  });
});
