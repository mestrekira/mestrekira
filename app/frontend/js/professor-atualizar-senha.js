import { API_URL } from './config.js';
import { notify, authFetch, getUser, clearAuth } from './auth.js';
import { readErrorMessage } from './auth.js';

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg || '';
}

function getRoleUpperFromLS() {
  const u = getUser();
  return String(u?.role || '').trim().toUpperCase();
}

function isSchoolManagedProfessor() {
  const u = getUser();
  const role = getRoleUpperFromLS();
  const pType = String(u?.professorType || '').toUpperCase();
  return (role === 'PROFESSOR' || role === 'TEACHER') && pType === 'SCHOOL';
}

function mustChangePassword() {
  const u = getUser();
  return !!u?.mustChangePassword;
}

async function postFirstPassword(password) {
  const res = await authFetch(`${API_URL}/auth/first-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Erro ao definir senha.');
    throw new Error(msg);
  }

  return res.json();
}

(async function init() {
  // esta página só faz sentido para professor gerenciado e mustChangePassword=true
  const u = getUser();
  if (!u || !isSchoolManagedProfessor()) {
    notify('warn', 'Acesso inválido', 'Faça login novamente.');
    clearAuth();
    window.location.replace('professor-escola-verificar.html');
    return;
  }
  if (!mustChangePassword()) {
    // já atualizou
    window.location.replace('professor-salas.html');
    return;
  }

  const btnSave = $('btnSave');

  btnSave?.addEventListener('click', async () => {
    const p1 = String($('pass1')?.value || '');
    const p2 = String($('pass2')?.value || '');

    if (!p1 || p1.length < 8) {
      notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (p1 !== p2) {
      notify('warn', 'Não confere', 'As senhas não são iguais.');
      return;
    }

    setStatus('Salvando...');
    btnSave.disabled = true;

    try {
      const data = await postFirstPassword(p1);

      // Atualiza flag no localStorage.user (sem depender de /users/me)
      const updatedUser = { ...u, mustChangePassword: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      notify('success', 'Pronto', data?.message || 'Senha definida.');
      window.location.replace('professor-salas.html');
    } catch (e) {
      const msg = String(e?.message || 'Erro ao salvar senha.');
      setStatus('');
      notify('error', 'Erro', msg);
    } finally {
      btnSave.disabled = false;
    }
  });
})();
