// trocar-senha.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = {
  token: 'token',
  user: 'user',
  professorId: 'professorId',
  studentId: 'studentId',
};

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
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
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

function ensureProfessorSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const professorId = localStorage.getItem(LS.professorId);

  const role = normRole(user?.role);
  if (!token || !professorId || (role !== 'PROFESSOR' && role !== 'TEACHER')) {
    notify('warn', 'Sessão inválida', 'Faça login novamente.');
    window.location.replace('login-professor.html');
    return null;
  }

  // evita conflito de papel
  localStorage.removeItem(LS.studentId);

  return { token, professorId, user };
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

  disable(saveBtn, true);
  notify('info', 'Salvando...', 'Atualizando sua senha...', 1800);

  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(sess.professorId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.token}`,
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

    // atualiza user no storage: mustChangePassword deve virar false (se backend setar)
    // se seu backend não retorna o user atualizado, seguimos mesmo assim.
    const user = safeJsonParse(localStorage.getItem(LS.user)) || {};
    const merged = { ...user, mustChangePassword: false };
    localStorage.setItem(LS.user, JSON.stringify(merged));

    notify('success', 'Tudo certo', 'Senha atualizada. Vamos continuar!', 1200);
    window.location.replace('professor-salas.html');
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
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
