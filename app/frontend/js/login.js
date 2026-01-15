const status = document.getElementById('status');

// ✅ Se já estiver logado, manda direto para o painel correto
const professorId = localStorage.getItem('professorId');
const studentId = localStorage.getItem('studentId');

if (professorId) {
  status.textContent = 'Você já está logado como professor. Redirecionando...';
  window.location.href = 'professor-salas.html';
}

if (!professorId && studentId) {
  status.textContent = 'Você já está logado como aluno. Redirecionando...';
  window.location.href = 'painel-aluno.html';
}

// ✅ Botões
document.getElementById('goProfessorBtn').addEventListener('click', () => {
  window.location.href = 'login-professor.html';
});

document.getElementById('goStudentLoginBtn').addEventListener('click', () => {
  window.location.href = 'login-aluno.html';
});

document.getElementById('goStudentCodeBtn').addEventListener('click', () => {
  window.location.href = 'entrar-sala.html';
});
