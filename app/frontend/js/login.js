// js/login.js

const status = document.getElementById('status');

const LS = {
  token: 'token',
  user: 'user',
  studentId: 'studentId',
  professorId: 'professorId',
};

function setStatus(msg) {
  if (status) status.textContent = String(msg || '');
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function norm(v) {
  const s = String(v ?? '').trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

function normRole(role) {
  return String(role || '').trim().toUpperCase(); // STUDENT | PROFESSOR | SCHOOL
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.professorId);
}

(function boot() {
  const token = norm(localStorage.getItem(LS.token));
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  const professorId = norm(localStorage.getItem(LS.professorId));
  const studentId = norm(localStorage.getItem(LS.studentId));

  // ✅ conflito (não deveria acontecer)
  if (professorId && studentId) {
    clearAuthStorage();
    setStatus('Sessão inválida detectada. Faça login novamente.');
    return;
  }

  // ✅ se tem token + role coerente, redireciona
  // (preferimos role, porque id no storage pode ficar legado)
  if (token && role) {
    if (role === 'PROFESSOR') {
      setStatus('Você já está logado como professor. Redirecionando...');
      window.location.replace('professor-salas.html');
      return;
    }

    if (role === 'STUDENT' || role === 'ALUNO') {
      setStatus('Você já está logado como aluno. Redirecionando...');
      window.location.replace('painel-aluno.html');
      return;
    }

    if (role === 'SCHOOL' || role === 'ESCOLA') {
      // Se você ainda não tiver painel de escola, manda pra página que existir
      // Ajuste aqui quando criar o painel escolar.
      setStatus('Você já está logado como escola. Redirecionando...');
      window.location.replace('painel-escola.html'); // troque se tiver outro nome
      return;
    }
  }

  // ✅ fallback: se não tem token, mas tem id legado (muito comum em projetos antigos)
  // (Melhor prática: não confiar nisso. Aqui apenas ajuda usuários que ficaram logados)
  if (!token) {
    if (professorId) {
      setStatus('Sessão antiga detectada. Faça login novamente.');
      clearAuthStorage();
      return;
    }
    if (studentId) {
      setStatus('Sessão antiga detectada. Faça login novamente.');
      clearAuthStorage();
      return;
    }
  }
})();

// ✅ Botões
document.getElementById('goProfessorBtn')?.addEventListener('click', () => {
  window.location.href = 'login-professor.html';
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

document.getElementById('goStudentCodeBtn')?.addEventListener('click', () => {
  window.location.href = 'entrar-sala.html';
});
