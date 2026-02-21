import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el?.value ?? '';
}

function isValidEmail(email) {
  // validação simples (suficiente pro frontend)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('signupBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name = String(getValue('name')).trim();
    const email = String(getValue('email')).trim().toLowerCase();
    const password = String(getValue('password'));

    setStatus('');

    if (!name || !email || !password) {
      setStatus('Preencha nome, e-mail e senha.');
      return;
    }

    if (!isValidEmail(email)) {
      setStatus('Digite um e-mail válido.');
      return;
    }

    if (password.length < 8) {
      setStatus('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    disable(btn, true);
    setStatus('Criando conta...');

    try {
      const res = await fetch(`${API_URL}/users/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await readJsonSafe(res);

      if (!data) {
        setStatus('Resposta inválida do servidor. Tente novamente.');
        disable(btn, false);
        return;
      }

      if (!res.ok || !data?.ok) {
        setStatus(data?.message || data?.error || 'Erro ao criar conta.');
        disable(btn, false);
        return;
      }

      setStatus(
        'Conta criada! Enviamos um link de verificação para seu e-mail. Confirme a conta para poder entrar.',
      );

      // limpeza de campos
      const nameEl = document.getElementById('name');
      const emailEl = document.getElementById('email');
      const passEl = document.getElementById('password');
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (passEl) passEl.value = '';

      disable(btn, false);
      // opcional:
      // setTimeout(() => window.location.replace('login-aluno.html'), 2500);
    } catch {
      setStatus('Erro ao criar conta. Tente novamente.');
      disable(btn, false);
    }
  });
});
