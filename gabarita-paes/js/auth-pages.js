(() => {
  'use strict';
  const API = 'https://mestrekira-api.onrender.com';
  const page = document.body.dataset.page;
  const form = document.getElementById('auth-form');
  const message = document.getElementById('message');
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('token');
  if (page === 'reset') history.replaceState(null, '', location.pathname);

  function show(text, error = false) {
    message.hidden = false;
    message.textContent = text;
    message.classList.toggle('error', error);
  }
  async function post(path, data) {
    const response = await fetch(`${API}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      const detail = result.message || result.error;
      throw new Error(Array.isArray(detail) ? detail.join(' ') : detail || 'Não foi possível concluir. Tente novamente.');
    }
    return result;
  }

  if (page === 'verify') {
    const ok = params.get('ok') === '1';
    show(ok ? 'E-mail confirmado. Entre na sua conta para começar.' :
      (params.get('msg') || 'O link é inválido ou expirou. Solicite outro link.'), !ok);
    form.hidden = ok;
  }
  if (page === 'reset' && !resetToken) {
    form.hidden = true;
    show('O link não contém um token válido. Solicite outro link de recuperação.', true);
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      if (page === 'verify') {
        await post('/auth/request-verify', { email: form.elements.namedItem('email').value.trim(), expectedRole: 'student', origin: 'GABARITA' });
        show('Se o e-mail existir e ainda não tiver sido confirmado, enviaremos um novo link.');
      } else if (page === 'recover') {
        await post('/auth/request-password-reset', { email: form.elements.namedItem('email').value.trim(), origin: 'GABARITA' });
        show('Se o e-mail existir, enviaremos um link para redefinir a senha.');
      } else {
        const password = form.elements.namedItem('password').value;
        if (password !== form.elements.namedItem('confirm').value) throw new Error('As senhas digitadas não coincidem.');
        await post('/auth/reset-password', { token: resetToken, newPassword: password });
        form.hidden = true;
        show('Senha atualizada. Entre novamente com a nova senha.');
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.', true);
    } finally {
      button.disabled = false;
    }
  });
})();
