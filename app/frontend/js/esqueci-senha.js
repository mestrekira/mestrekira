import { API_URL } from './config.js';

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('email');
  const btn = document.getElementById('sendBtn');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    const email = (emailEl?.value || '').trim().toLowerCase();
    setStatus('');

    if (!email || !email.includes('@')) {
      setStatus('Digite um e-mail válido.');
      return;
    }

    disable(btn, true);
    setStatus('Enviando link...');

    try {
      const res = await fetch(`${API_URL}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus(data?.message || data?.error || 'Não foi possível enviar agora.');
        disable(btn, false);
        return;
      }

      // ✅ segurança: backend responde ok mesmo se e-mail não existir
      setStatus('Se o e-mail existir, enviaremos um link. Verifique a caixa de entrada e o Spam.');

      disable(btn, false);
    } catch {
      setStatus('Erro ao enviar link. Tente novamente.');
      disable(btn, false);
    }
  });
});
