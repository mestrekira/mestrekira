document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  const alertBox = document.getElementById('alert-box');
  const btnSubmit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('senha').value;

    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Entrando...';

    try {
      const res = await window.api.post('/auth/login', { email, password });
      
      const token = res?.token || res?.access_token || res?.data?.token;

      if (token) {
        window.api.setToken(token);
        window.location.href = 'simulado.html';
      } else {
        throw new Error('Servidor não retornou o token de acesso.');
      }
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fee2e2';
      alertBox.style.color = '#991b1b';
      // Exibe a mensagem real retornada pelo backend (ex: se o e-mail não foi verificado)
      alertBox.innerText = err.message || 'E-mail ou senha incorretos.';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Entrar na Plataforma';
    }
  });
});
