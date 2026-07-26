import { API_URL } from './config.js';
import {
  notify,
  authFetch,
  getUser,
  clearAuth,
  readErrorMessage,
} from './auth.js';

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg || '';
}

function sanitizeToken(value) {
  let token = String(value || '').trim();
  token = token.replace(/^Bearer\s+/i, '').trim();
  token = token.replace(/^['"]+|['"]+$/g, '').trim();
  return token;
}

function getRoleUpperFromLS() {
  const user = getUser();
  return String(user?.role || '').trim().toUpperCase();
}

function isSchoolManagedProfessor() {
  const user = getUser();
  const role = getRoleUpperFromLS();
  const professorType = String(user?.professorType || '')
    .trim()
    .toUpperCase();

  return (
    (role === 'PROFESSOR' || role === 'TEACHER') &&
    professorType === 'SCHOOL'
  );
}

function mustChangePassword() {
  return !!getUser()?.mustChangePassword;
}

function clearSession() {
  clearAuth();
  localStorage.removeItem('schoolId');
  localStorage.removeItem('studentId');
  localStorage.removeItem('professorId');
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function postFirstPassword(password) {
  const response = await authFetch(
    `${API_URL}/auth/first-password`,
    {
      method: 'POST',
      body: JSON.stringify({ password }),
    },
    { redirectTo: 'login-professor.html' },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      'Erro ao definir senha.',
    );
    throw new Error(message);
  }

  return response.json();
}

async function renewProfessorSession(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
    }),
  });

  const data = await readJsonSafe(response);

  if (!response.ok || !data?.ok || !data?.token || !data?.user) {
    const message =
      data?.message ||
      data?.error ||
      'Não foi possível renovar a sessão.';
    throw new Error(message);
  }

  const token = sanitizeToken(data.token);
  const user = data.user;
  const role = String(user?.role || '').trim().toUpperCase();

  if (
    !token ||
    !user?.id ||
    (role !== 'PROFESSOR' && role !== 'TEACHER')
  ) {
    throw new Error('O servidor retornou uma sessão inválida.');
  }

  return { token, user };
}

function saveRenewedSession(session, previousUser) {
  const user = {
    ...(previousUser || {}),
    ...(session.user || {}),
    mustChangePassword: false,
  };

  localStorage.setItem('token', session.token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('professorId', String(user.id));
  localStorage.removeItem('studentId');
  localStorage.removeItem('schoolId');
}

(function init() {
  const initialUser = getUser();

  if (!initialUser || !isSchoolManagedProfessor()) {
    notify('warn', 'Acesso inválido', 'Faça login novamente.');
    clearSession();
    window.location.replace('professor-escola-verificar.html');
    return;
  }

  if (!mustChangePassword()) {
    window.location.replace('professor-salas.html');
    return;
  }

  const btnSave = $('btnSave');

  btnSave?.addEventListener('click', async () => {
    const password = String($('pass1')?.value || '');
    const confirmation = String($('pass2')?.value || '');

    if (!password || password.length < 8) {
      notify(
        'warn',
        'Senha fraca',
        'A senha deve ter no mínimo 8 caracteres.',
      );
      return;
    }

    if (password !== confirmation) {
      notify('warn', 'Não confere', 'As senhas não são iguais.');
      return;
    }

    const email = String(initialUser.email || '').trim().toLowerCase();
    if (!email) {
      notify(
        'error',
        'Sessão inválida',
        'Não foi possível identificar o e-mail do professor.',
      );
      clearSession();
      window.location.replace('login-professor.html');
      return;
    }

    setStatus('Salvando...');
    btnSave.disabled = true;
    let passwordChanged = false;

    try {
      const result = await postFirstPassword(password);
      passwordChanged = true;

      setStatus('Renovando sessão...');
      const renewedSession = await renewProfessorSession(email, password);
      saveRenewedSession(renewedSession, initialUser);

      setStatus('');
      notify(
        'success',
        'Pronto',
        result?.message || 'Senha definida com sucesso.',
      );
      window.location.replace('professor-salas.html');
    } catch (error) {
      const message = String(
        error?.message || 'Erro ao salvar a senha.',
      );

      if (passwordChanged) {
        clearSession();
        setStatus('Senha atualizada. Faça login novamente.');
        notify(
          'warn',
          'Senha atualizada',
          'A senha foi alterada, mas a sessão não pôde ser renovada. Faça login com a nova senha.',
          5000,
        );
        setTimeout(
          () => window.location.replace('login-professor.html'),
          1800,
        );
        return;
      }

      setStatus('');
      notify('error', 'Erro', message);
    } finally {
      btnSave.disabled = false;
    }
  });
})();
