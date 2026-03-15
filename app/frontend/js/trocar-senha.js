import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
  schoolId: 'schoolId',
};

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration:
      duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = String(msg || '');
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function sanitizeToken(value) {
  let t = String(value || '').trim();

  if (/^Bearer\s+/i.test(t)) {
    t = t.replace(/^Bearer\s+/i, '').trim();
  }

  t = t.replace(/^['"]+|['"]+$/g, '').trim();

  return t;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.schoolId);
}

function ensureProfessorSession() {
  const token = sanitizeToken(localStorage.getItem(LS.token));
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const professorId = localStorage.getItem(LS.professorId);

  const role = normRole(user?.role);

  if (!token || !professorId || (role !== 'PROFESSOR' && role !== 'TEACHER')) {
    notify('warn', 'Sessão inválida', 'Faça login novamente.');
    clearAuthStorage();
    window.location.replace('login-professor.html');
    return null;
  }

  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.schoolId);
  localStorage.setItem(LS.token, token);

  return { token, professorId, user };
}

async function reloginProfessor(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
    }),
  });

  const data = await readJsonSafe(res);

  if (!res.ok || !data?.ok || !data?.token || !data?.user) {
    const msg = data?.message || data?.error || 'Não foi possível renovar a sessão.';
    throw new Error(msg);
  }

  const token = sanitizeToken(data.token);
  const user = data.user;

  if (!token || !user?.id) {
    throw new Error('Resposta inválida ao renovar a sessão.');
  }

  localStorage.setItem(LS.token, token);
  localStorage.setItem(LS.user, JSON.stringify(user));
  localStorage.setItem(LS.professorId, String(user.id));
  localStorage.removeItem(LS.studentId);
  localStorage.removeItem(LS.schoolId);

  return { token, user };
}

async function salvarNovaSenha() {
  const sess = ensureProfessorSession();
  if (!sess) return;

  const newPassEl = document.getElementById('newPassword');
  const confirmEl = document.getElementById('confirmPassword');
  const saveBtn = document.getElementById('saveBtn');

  const p1 = String(newPassEl?.value || '');
  const p2 = String(confirmEl?.value || '');

  setStatus('');

  if (!p1 || !p2) {
    notify('warn', 'Campos obrigatórios', 'Preencha a nova senha e a confirmação.');
    return;
  }
  if (p1.length < 8) {
    notify('warn', 'Senha fraca', 'A senha deve ter no mínimo 8 caracteres.');
    return;
  }
  if (p1 !== p2) {
    notify('warn', 'Confirmação', 'As senhas não coincidem.');
    return;
  }

  const email = String(sess.user?.email || '').trim().toLowerCase();
  if (!email) {
    notify('error', 'Erro', 'Não foi possível identificar o e-mail da sessão atual.');
    clearAuthStorage();
    window.location.replace('login-professor.html');
    return;
  }

  disable(saveBtn, true);
  notify('info', 'Salvando...', 'Atualizando sua senha...', 1800);

  try {
    // ✅ fluxo correto de primeiro acesso
    const res = await fetch(`${API_URL}/auth/first-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanitizeToken(sess.token)}`,
      },
      body: JSON.stringify({ password: p1 }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível atualizar a senha.';
      notify('error', 'Erro', msg);
      setStatus(msg);
      return;
    }

    // ✅ importantíssimo: renovar token
    const renewed = await reloginProfessor(email, p1);

    const mergedUser = {
      ...(safeJsonParse(localStorage.getItem(LS.user)) || {}),
      ...(renewed.user || {}),
      mustChangePassword: false,
    };

    localStorage.setItem(LS.user, JSON.stringify(mergedUser));
    localStorage.setItem(LS.token, sanitizeToken(renewed.token));
    localStorage.setItem(LS.professorId, String(mergedUser.id || sess.professorId));

    notify('success', 'Tudo certo', 'Senha atualizada. Vamos continuar!', 1200);
    window.location.replace('professor-salas.html');
  } catch (e) {
    notify(
      'error',
      'Erro de conexão',
      String(e?.message || 'Não foi possível acessar o servidor agora.'),
    );
    setStatus(String(e?.message || 'Erro de conexão.'));
  } finally {
    disable(saveBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const sess = ensureProfessorSession();
  if (!sess) return;

  const saveBtn = document.getElementById('saveBtn');
  const confirmEl = document.getElementById('confirmPassword');

  if (saveBtn) saveBtn.addEventListener('click', salvarNovaSenha);

  if (confirmEl) {
    confirmEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') salvarNovaSenha();
    });
  }
});
