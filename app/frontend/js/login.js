const status = document.getElementById('status');

function validId(v) {
  return v && v !== 'undefined' && v !== 'null';
}

const professorId = localStorage.getItem('professorId');
const studentId = localStorage.getItem('studentId');
const schoolId = localStorage.getItem('schoolId'); // ✅ novo

// ✅ Se já estiver logado, manda direto
if (validId(professorId)) {
  if (status) status.textContent = 'Você já está logado como professor. Redirecionando...';
  window.location.replace('professor-salas.html');
} else if (validId(schoolId)) {
  if (status) status.textContent = 'Você já está logado como escola. Redirecionando...';
  window.location.replace('painel-escola.html');
} else if (validId(studentId)) {
  if (status) status.textContent = 'Você já está logado como aluno. Redirecionando...';
  window.location.replace('painel-aluno.html');
}

// ✅ Botões
document.getElementById('goProfessorBtn')?.addEventListener('click', () => {
  window.location.href = 'login-professor.html';
});

document.getElementById('goSchoolLoginBtn')?.addEventListener('click', () => {
  window.location.href = 'login-escola.html';
});

document.getElementById('goSchoolSignupBtn')?.addEventListener('click', () => {
  window.location.href = 'cadastro-escola.html';
});

document.getElementById('goStudentLoginBtn')?.addEventListener('click', () => {
  window.location.href = 'login-aluno.html';
});

document.getElementById('goStudentSignupBtn')?.addEventListener('click', () => {
  window.location.href = 'cadastro-aluno.html';
});

// (se existir no HTML, ok; se não existir, não quebra)
document.getElementById('goStudentCodeBtn')?.addEventListener('click', () => {
  window.location.href = 'entrar-sala.html';
});
