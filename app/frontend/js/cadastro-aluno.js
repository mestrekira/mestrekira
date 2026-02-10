import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const btn = document.getElementById('signupBtn');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name = (nameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim().toLowerCase();
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

    disable(btn, true);
    setStatus('Criando conta...');

    try {
      // ✅ mantém seu endpoint atual
      // (ele deve chamar AuthService.registerStudent por trás e enviar o e-mail)
      const res = await fetch(`${API_URL}/users/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus(data?.message || data?.error || 'Erro ao criar conta.');
        disable(btn, false);
        return;
      }

      // ✅ NÃO redireciona automaticamente (precisa verificar e-mail antes)
      setStatus(
        'Conta criada! Enviamos um link de verificação para seu e-mail. Confirme a conta para poder entrar.',
      );

      // limpeza de campos
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (passEl) passEl.value = '';

      disable(btn, false);

      // opcional: se você quiser ainda levar para login depois de alguns segundos, deixe isso comentado:
      // setTimeout(() => window.location.replace('login-aluno.html'), 2500);
    } catch {
      setStatus('Erro ao criar conta. Tente novamente.');
      disable(btn, false);
    }
  });
});
