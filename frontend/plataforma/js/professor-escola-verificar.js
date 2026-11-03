function $(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = $('status');
  const btnGoLogin = $('btnGoLogin');

  if (statusEl) {
    statusEl.textContent =
      'Agora o acesso do professor cadastrado pela escola é feito diretamente pelo login do professor, usando a senha temporária enviada por e-mail.';
  }

  if (btnGoLogin) {
    btnGoLogin.addEventListener('click', () => {
      window.location.href = 'login-professor.html';
    });
  }
});
