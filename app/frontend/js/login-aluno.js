async function fazerLogin() {
  const id = document.getElementById('id').value.trim();
  const password = document.getElementById('password').value;

  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  if (!id || !password) {
    errorEl.textContent = 'Preencha ID e senha.';
    return;
  }

  try {
    const result = await apiRequest('/users/login', 'POST', { id, password });

    // apiRequest sempre retorna JSON; se o backend responder erro, pode vir assim:
    if (!result || result.error) {
      errorEl.textContent = result?.error || 'Login inválido.';
      return;
    }

    // ✅ Se por algum motivo logar com professor aqui, redireciona correto
    if (result.role === 'professor') {
      localStorage.setItem('professorId', result.id);
      window.location.href = 'painel-professor.html';
      return;
    }

    // ✅ Fluxo do aluno
    localStorage.setItem('studentId', result.id);
    window.location.href = 'painel-aluno.html';

  } catch (e) {
    errorEl.textContent = 'Erro ao fazer login. Tente novamente.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  btn.addEventListener('click', fazerLogin);

  // Enter para login
  document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLogin();
  });
});
