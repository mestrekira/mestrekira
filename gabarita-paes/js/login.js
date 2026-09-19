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
      console.log('Resposta do login:', res);

      // Se o servidor avisar que a senha/usuário são inválidos ou se ok for false
      if (res?.ok === false || res?.error) {
        throw new Error(res.error || res.message || 'Usuário ou senha inválidos.');
      }

      // Captura o token retornado
      const token =
        res?.token ||
        res?.accessToken ||
        res?.access_token ||
        res?.jwt ||
        res?.data?.token ||
        res?.data?.accessToken;

      if (token) {
        window.api.setToken(token);

        if (res?.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
        }

        window.location.href = 'index.html';
      } else {
        throw new Error('Não foi possível identificar o token de acesso na resposta.');
      }
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fee2e2';
      alertBox.style.color = '#991b1b';
      alertBox.innerText = err.message || 'E-mail ou senha incorretos.';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Entrar na Plataforma';
    }
  });
});
