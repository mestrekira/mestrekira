import { API_URL } from './config.js';
import { toast, confirmDialog } from './ui-feedback.js';

/**
 * Enquanto a plataforma for grátis, não mostrar "Gerenciar conta".
 */
const BILLING_ENABLED = false;

function $(id) {
  return document.getElementById(id);
}

function safeText(el, value, fallback = '—') {
  if (!el) return;
  const ok = value !== undefined && value !== null && String(value).trim() !== '';
  el.textContent = ok ? String(value) : fallback;
}

function normalizeRole(role) {
  if (!role) return null;
  const r = String(role).trim().toUpperCase();

  if (r === 'PROFESSOR' || r === 'TEACHER') return 'professor';
  if (r === 'ALUNO' || r === 'STUDENT') return 'student';
  if (r === 'SCHOOL' || r === 'ESCOLA') return 'school';

  const low = String(role).trim().toLowerCase();
  if (low === 'professor') return 'professor';
  if (low === 'student') return 'student';
  if (low === 'school' || low === 'escola') return 'school';

  return null;
}

function roleLabel(roleNormalized) {
  if (roleNormalized === 'professor') return 'Professor(a)';
  if (roleNormalized === 'student') return 'Estudante';
  if (roleNormalized === 'school') return 'Escola';
  return '';
}

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
  schoolId: 'schoolId',
};

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function sanitizeToken(value) {
  let t = String(value || '').trim();

  if (/^Bearer\s+/i.test(t)) {
    t = t.replace(/^Bearer\s+/i, '').trim();
  }

  t = t.replace(/^['"]+|['"]+$/g, '').trim();

  return t;
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.schoolId);
}

function getSession() {
  const token = sanitizeToken(localStorage.getItem(LS.token) || '');
  const user = safeJsonParse(localStorage.getItem(LS.user));

  if (token) {
    localStorage.setItem(LS.token, token);
  }

  const roleFromUser = normalizeRole(user?.role);
  const idFromUser = user?.id ? String(user.id).trim() : null;

  if (
    roleFromUser &&
    idFromUser &&
    idFromUser !== 'undefined' &&
    idFromUser !== 'null'
  ) {
    if (roleFromUser === 'school') {
      localStorage.setItem(LS.schoolId, idFromUser);
      localStorage.removeItem(LS.professorId);
      localStorage.removeItem(LS.studentId);
    }

    if (roleFromUser === 'professor') {
      localStorage.setItem(LS.professorId, idFromUser);
      localStorage.removeItem(LS.studentId);
      localStorage.removeItem(LS.schoolId);
    }

    if (roleFromUser === 'student') {
      localStorage.setItem(LS.studentId, idFromUser);
      localStorage.removeItem(LS.professorId);
      localStorage.removeItem(LS.schoolId);
    }

    return { role: roleFromUser, id: idFromUser, token, user };
  }

  const professorId = localStorage.getItem(LS.professorId);
  if (professorId && professorId !== 'undefined' && professorId !== 'null') {
    localStorage.removeItem(LS.studentId);
    localStorage.removeItem(LS.schoolId);
    return { role: 'professor', id: String(professorId), token, user: null };
  }

  const studentId = localStorage.getItem(LS.studentId);
  if (studentId && studentId !== 'undefined' && studentId !== 'null') {
    localStorage.removeItem(LS.professorId);
    localStorage.removeItem(LS.schoolId);
    return { role: 'student', id: String(studentId), token, user: null };
  }

  const schoolId = localStorage.getItem(LS.schoolId);
  if (schoolId && schoolId !== 'undefined' && schoolId !== 'null') {
    localStorage.removeItem(LS.professorId);
    localStorage.removeItem(LS.studentId);
    return { role: 'school', id: String(schoolId), token, user: null };
  }

  return { role: null, id: null, token: '', user: null };
}

// ---------------- Foto ----------------
function photoKey(role, id) {
  return role && id ? `mk_photo_${role}_${id}` : 'mk_photo_guest';
}

function placeholderAvatar(size = 72) {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="${Math.round(
          size * 0.35
        )}" text-anchor="middle" fill="#888">👤</text>
      </svg>`
    )
  );
}

function loadPhoto(role, id) {
  const img = $('menuPhotoImg');
  if (!img) return;

  const dataUrl = localStorage.getItem(photoKey(role, id));
  img.src = dataUrl || placeholderAvatar(84);
  img.style.display = 'inline-block';
}

// ---------------- Auth fetch helper ----------------
function redirectAfterLogout(
  role,
  logoutRedirectProfessor,
  logoutRedirectStudent,
  logoutRedirectSchool,
  fallback = 'index.html'
) {
  if (role === 'professor') window.location.href = logoutRedirectProfessor;
  else if (role === 'student') window.location.href = logoutRedirectStudent;
  else if (role === 'school') window.location.href = logoutRedirectSchool;
  else window.location.href = fallback;
}

async function authFetchMenu(path, { method = 'GET', token, body } = {}) {
  const cleanToken = sanitizeToken(token);

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cleanToken) headers.Authorization = `Bearer ${cleanToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`AUTH_${res.status}`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function tryFetchMe(token) {
  const cleanToken = sanitizeToken(token);
  if (!cleanToken) return null;

  try {
    return await authFetchMenu('/users/me', { token: cleanToken, method: 'GET' });
  } catch {
    return null;
  }
}

async function tryFetchUserById(id, token) {
  const cleanToken = sanitizeToken(token);
  if (!id || id === 'undefined' || id === 'null' || !cleanToken) return null;

  try {
    return await authFetchMenu(`/users/${encodeURIComponent(id)}`, {
      token: cleanToken,
      method: 'GET',
    });
  } catch {
    return null;
  }
}

export function initMenuPerfil(options = {}) {
  const {
    loginRedirect = 'index.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
    logoutRedirectSchool = 'login-escola.html',
  } = options;

  const menuBtn = $('menuBtn');
  const menuPanel = $('menuPanel');
  const closeBtn = $('menuCloseBtn');

  if (!menuBtn || !menuPanel) return;
  if (menuPanel.dataset.mkInit === '1') return;
  menuPanel.dataset.mkInit = '1';

  menuBtn.addEventListener('click', () => menuPanel.classList.toggle('open'));
  if (closeBtn) {
    closeBtn.addEventListener('click', () => menuPanel.classList.remove('open'));
  }

  const session = getSession();
  const role = session.role;
  const id = session.id;
  const token = sanitizeToken(session.token);

  if (token) {
    localStorage.setItem(LS.token, token);
  }

  const manageAccountLink = $('manageAccountLink');
  if (manageAccountLink) {
    manageAccountLink.style.display = BILLING_ENABLED ? '' : 'none';
  }

  const meIdEl = $('meId');
  if (meIdEl) meIdEl.textContent = '';

  const meNameEl = $('meName');
  const meEmailEl = $('meEmail');
  const meRoleEl = $('meRole');

  const logoutBtn = $('logoutMenuBtn');
  const deleteBtn = $('deleteAccountBtn');

  const saveBtn = $('saveProfileBtn');
  const newEmailEl = $('newEmail');
  const newPassEl = $('newPass');
  const statusEl = $('menuStatus');

  if (!role || !id) {
    safeText(meNameEl, 'Visitante', 'Visitante');
    safeText(meEmailEl, '', '');
    safeText(meRoleEl, '', '');
    loadPhoto(null, null);

    if (saveBtn) saveBtn.style.display = 'none';
    if (newEmailEl) newEmailEl.style.display = 'none';
    if (newPassEl) newPassEl.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';

    if (logoutBtn) {
      logoutBtn.textContent = 'Entrar';
      logoutBtn.addEventListener('click', () => {
        menuPanel.classList.remove('open');
        window.location.href = loginRedirect;
      });
    }
    return;
  }

  safeText(meRoleEl, roleLabel(role), '');
  loadPhoto(role, id);

  if (deleteBtn) {
    deleteBtn.style.display =
      role === 'student' || role === 'school' ? '' : 'none';
  }

  const photoInput = $('menuPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        toast({
          title: 'Formato inválido',
          message: 'Use PNG ou JPG.',
          type: 'warn',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          localStorage.setItem(photoKey(role, id), reader.result);
          loadPhoto(role, id);
          toast({
            title: 'Pronto!',
            message: 'Foto atualizada.',
            type: 'success',
          });
        } catch {
          toast({
            title: 'Erro',
            message: 'Não foi possível salvar a foto.',
            type: 'error',
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }

  (async () => {
    const me = (await tryFetchMe(token)) || (await tryFetchUserById(id, token));

    if (me) {
      safeText(meNameEl, me.name);
      safeText(meEmailEl, me.email);

      const normalized = normalizeRole(me.role);
      const resolvedRole = normalized || role;
      safeText(meRoleEl, roleLabel(resolvedRole), '');

      if (resolvedRole === 'school' && me?.id) {
        localStorage.setItem(LS.schoolId, String(me.id));
        localStorage.removeItem(LS.professorId);
        localStorage.removeItem(LS.studentId);
      }

      if (resolvedRole === 'professor' && me?.id) {
        localStorage.setItem(LS.professorId, String(me.id));
        localStorage.removeItem(LS.studentId);
        localStorage.removeItem(LS.schoolId);
      }

      if (resolvedRole === 'student' && me?.id) {
        localStorage.setItem(LS.studentId, String(me.id));
        localStorage.removeItem(LS.professorId);
        localStorage.removeItem(LS.schoolId);
      }

      const merged = { ...(session.user || {}), ...me };
      localStorage.setItem(LS.user, JSON.stringify(merged));
    } else {
      const u = session.user;
      if (u) {
        safeText(meNameEl, u.name, '—');
        safeText(meEmailEl, u.email, '—');
      } else {
        safeText(meNameEl, '—', '—');
        safeText(meEmailEl, '—', '—');
      }
      safeText(meRoleEl, roleLabel(role), '');
    }
  })();

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const email = String(newEmailEl?.value || '').trim();
      const password = String(newPassEl?.value || '');

      if (!email && !password) {
        if (statusEl) statusEl.textContent = 'Nada para salvar.';
        toast({
          title: 'Nada a fazer',
          message: 'Preencha e-mail ou senha para atualizar.',
          type: 'info',
        });
        return;
      }

      if (password && password.length < 8) {
        if (statusEl) statusEl.textContent = 'Senha deve ter no mínimo 8 caracteres.';
        toast({
          title: 'Senha inválida',
          message: 'A senha deve ter no mínimo 8 caracteres.',
          type: 'warn',
        });
        return;
      }

      const payload = {};
      if (email) payload.email = email;
      if (password) payload.password = password;

      try {
        if (statusEl) statusEl.textContent = 'Salvando...';

        const updated = await authFetchMenu('/users/me', {
          method: 'PATCH',
          token,
          body: payload,
        });

        if (updated && typeof updated === 'object') {
          const currentUser = safeJsonParse(localStorage.getItem(LS.user)) || {};
          const merged = { ...currentUser, ...updated };
          localStorage.setItem(LS.user, JSON.stringify(merged));
        }

        if (statusEl) statusEl.textContent = 'Dados atualizados.';
        toast({
          title: 'Atualizado',
          message: 'Seus dados foram atualizados.',
          type: 'success',
        });

        if (newEmailEl) newEmailEl.value = '';
        if (newPassEl) newPassEl.value = '';
      } catch (e) {
        const msg = String(e?.message || 'Erro ao atualizar dados.');
        if (msg.startsWith('AUTH_')) {
          toast({
            title: 'Sessão expirada',
            message: 'Faça login novamente.',
            type: 'warn',
          });
          sessionStorage.setItem('mk_just_logged_out', '1');
          clearAuthStorage();
          redirectAfterLogout(
            role,
            logoutRedirectProfessor,
            logoutRedirectStudent,
            logoutRedirectSchool,
            loginRedirect
          );
          return;
        }

        if (statusEl) statusEl.textContent = 'Erro ao atualizar dados.';
        toast({ title: 'Erro', message: msg, type: 'error' });
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      menuPanel.classList.remove('open');

      toast({
        title: 'Saindo...',
        message: 'Você foi desconectado.',
        type: 'info',
        duration: 1200,
      });

      sessionStorage.setItem('mk_just_logged_out', '1');
      clearAuthStorage();

      redirectAfterLogout(
        role,
        logoutRedirectProfessor,
        logoutRedirectStudent,
        logoutRedirectSchool,
        loginRedirect
      );
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Excluir conta',
        message:
          'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
        okText: 'Sim, excluir',
        cancelText: 'Cancelar',
      });

      if (!ok) return;

      try {
        if (role === 'school') {
          await authFetchMenu('/school-dashboard/account', {
            method: 'DELETE',
            token,
          });
        } else if (role === 'student') {
          await authFetchMenu('/users/me', {
            method: 'DELETE',
            token,
          });
        } else {
          toast({
            title: 'Ação indisponível',
            message: 'Este perfil não pode excluir a conta.',
            type: 'warn',
          });
          return;
        }

        localStorage.removeItem(photoKey(role, id));
        sessionStorage.setItem('mk_just_logged_out', '1');
        clearAuthStorage();

        toast({
          title: 'Conta excluída',
          message: 'Sua conta foi removida com sucesso.',
          type: 'success',
        });

        redirectAfterLogout(
          role,
          logoutRedirectProfessor,
          logoutRedirectStudent,
          logoutRedirectSchool,
          loginRedirect
        );
      } catch (e) {
        const msg = String(e?.message || 'Erro ao excluir conta.');

        if (msg.startsWith('AUTH_')) {
          toast({
            title: 'Sessão expirada',
            message: 'Faça login novamente.',
            type: 'warn',
          });
          sessionStorage.setItem('mk_just_logged_out', '1');
          clearAuthStorage();
          redirectAfterLogout(
            role,
            logoutRedirectProfessor,
            logoutRedirectStudent,
            logoutRedirectSchool,
            loginRedirect
          );
          return;
        }

        toast({ title: 'Erro', message: msg, type: 'error' });
      }
    });
  }
}
