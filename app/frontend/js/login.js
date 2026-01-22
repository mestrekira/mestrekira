const status = document.getElementById('status');

function validId(v) {
  return v && v !== 'undefined' && v !== 'null';
}

const professorId = localStorage.getItem('professorId');
const studentId = localStorage.getItem('studentId');

if (validId(professorId)) {
  if (status) status.textContent = 'Você já está logado como professor. Redirecionando...';
  window.location.replace('professor-salas.html');
} else if (validId(studentId)) {
  if (status) status.textContent = 'Você já está logado como aluno. Redirecionando...';
  window.location.replace('painel-aluno.html');
}

// Botões
document.getElementById('goProfessorBtn')?.addEventListener('click', () => {
  window.location.href = 'login-professor.html';
});

document.getElementById('goStudentLoginBtn')?.addEventListener('click', () => {
  window.location.href = 'login-aluno.html';
});

document.getElementById('goStudentCodeBtn')?.addEventListener('click', () => {
  window.location.href = 'entrar-sala.html';
});
