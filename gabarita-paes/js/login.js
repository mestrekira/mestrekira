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
      console.log('Resposta completa do login:', res);

      // Captura o token em qualquer formato que o backend retornar
      const token =
        res?.token ||
        res?.accessToken ||
        res?.access_token ||
        res?.jwt ||
        res?.data?.token ||
        res?.data?.accessToken ||
        (typeof res === 'string' ? res : null);

      if (token) {
        window.api.setToken(token);
        
        // Guarda também os dados do usuário se vierem na resposta
        if (res?.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
        }

        window.location.href = 'simulado.html';
      } else {
        // Se ainda não achar, exibe na tela o formato exato que o servidor devolveu
        throw new Error('Formato inesperado: ' + JSON.stringify(res));
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
