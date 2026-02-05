import { API_URL } from './config.js';
import { toast, confirmDialog } from './ui-feedback.js';

function $(id) {
  return document.getElementById(id);
}

function safeText(el, value, fallback = '—') {
  if (!el) return;
  const ok = value !== undefined && value !== null && String(value).trim() !== '';
  el.textContent = ok ? String(value) : fallback;
}

/**
 * ✅ Normaliza o papel vindo do backend/legado
 * - "PROFESSOR" -> "professor"
 * - "ALUNO" / "STUDENT" -> "student"
 * - também aceita "professor"/"student" em qualquer case
 */
function normalizeRole(role) {
  if (!role) return null;
  const r = String(role).trim().toUpperCase();

  if (r === 'PROFESSOR') return 'professor';
  if (r === 'ALUNO' || r === 'STUDENT') return 'student';

  // fallback se vier minúsculo/misto
  if (String(role).trim().toLowerCase() === 'professor') return 'professor';
  if (String(role).trim().toLowerCase() === 'student') return 'student';

  return null;
}

/**
 * ✅ Texto exibido no menu (inclusive)
 * Mantém "professor/student" internamente, mas exibe como você quer.
 */
function roleLabel(roleNormalized) {
  if (roleNormalized === 'professor') return 'Professor(a)';
  if (roleNormalized === 'student') return 'Estudante';
  return '';
}

function getRoleAndId() {
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');

  if (professorId && professorId !== 'undefined' && professorId !== 'null') {
    return { role: 'professor', id: professorId };
  }
  if (studentId && studentId !== 'undefined' && studentId !== 'null') {
    return { role: 'student', id: studentId };
  }
  return { role: null, id: null };
}

function photoKey(role, id) {
  return role && id ? `mk_photo_${role}_${id}` : 'mk_photo_guest';
}

function loadPhoto(role, id) {
  const img = $('menuPhotoImg');
  if (!img) return;

  const dataUrl = localStorage.getItem(photoKey(role, id));
  if (dataUrl) {
    img.src = dataUrl;
  } else {
    img.removeAttribute('src');
  }
  img.style.display = 'inline-block';
}

// ✅ nunca chama /users/undefined
async function tryFetchMe(role, id) {
  if (!role || !id || id === 'undefined' || id === 'null') return null;

  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function initMenuPerfil(options = {}) {
  const {
    loginRedirect = 'index.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = options;

  const menuBtn = $('menuBtn');
  const menuPanel = $('menuPanel');
  const closeBtn = $('menuCloseBtn');

  // se a página nem tem menu, sai
  if (!menuBtn || !menuPanel) return;

  // ✅ evita duplicar listeners mesmo se houver 2 scripts/2 chamadas
  if (menuPanel.dataset.mkInit === '1') return;
  menuPanel.dataset.mkInit = '1';

  menuBtn.addEventListener('click', () => {
    menuPanel.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      menuPanel.classList.remove('open');
    });
  }

  const { role, id } = getRoleAndId();

  // ✅ NÃO exibir ID (se existir no HTML)
  const meIdEl = $('meId');
  if (meIdEl) meIdEl.textContent = '';

  // visitante
  if (!role || !id) {
    safeText($('meName'), 'Visitante', 'Visitante');
    safeText($('meEmail'), '', '');
    safeText($('meRole'), '', '');
    loadPhoto(null, null);

    const logoutBtn = $('logoutMenuBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    const delBtn = $('deleteAccountBtn');
    if (delBtn) delBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    const saveBtn = $('saveProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    return;
  }

  // ✅ EXIBIÇÃO DO PERFIL (ajustado)
  safeText($('meRole'), roleLabel(role));
  loadPhoto(role, id);

  // Foto local
  const photoInput = $('menuPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        toast({ title: 'Formato inválido', message: 'Use PNG ou JPG.', type: 'warn' });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(photoKey(role, id), reader.result);
        loadPhoto(role, id);
        toast({ title: 'Pronto!', message: 'Foto atualizada.', type: 'success' });
      };
      reader.readAsDataURL(file);
    });
  }

  // busca nome/email no backend
  (async () => {
    const me = await tryFetchMe(role, id);
    if (me) {
      safeText($('meName'), me.name);
      safeText($('meEmail'), me.email);

      // se vier role do backend (PROFESSOR/STUDENT/ALUNO etc)
      const normalized = normalizeRole(me.role);
      if (normalized) {
        safeText($('meRole'), roleLabel(normalized));
      } else {
        // se não vier normalizado, mantém o do localStorage
        safeText($('meRole'), roleLabel(role));
      }
    } else {
      safeText($('meName'), '—', '—');
      safeText($('meEmail'), '—', '—');
      safeText($('meRole'), roleLabel(role), '');
    }
  })();

  // salvar alterações (PATCH)
  const saveBtn = $('saveProfileBtn');
  const newEmail = $('newEmail');
  const newPass = $('newPass');
  const statusEl = $('menuStatus');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const email = newEmail?.value?.trim();
      const password = newPass?.value || '';

      if (!email && !password) {
        if (statusEl) statusEl.textContent = 'Nada para salvar.';
        toast({ title: 'Nada a fazer', message: 'Preencha e-mail ou senha para atualizar.', type: 'info' });
        return;
      }

      if (password && password.length < 8) {
        if (statusEl) statusEl.textContent = 'Senha deve ter no mínimo 8 caracteres.';
        toast({ title: 'Senha inválida', message: 'A senha deve ter no mínimo 8 caracteres.', type: 'warn' });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) throw new Error();

        if (statusEl) statusEl.textContent = 'Dados atualizados.';
        toast({ title: 'Atualizado', message: 'Seus dados foram atualizados.', type: 'success' });

        if (newEmail) newEmail.value = '';
        if (newPass) newPass.value = '';
      } catch {
        if (statusEl) statusEl.textContent = 'Erro ao atualizar dados.';
        toast({ title: 'Erro', message: 'Erro ao atualizar dados.', type: 'error' });
      }
    });
  }

  // logout (menu)
  const logoutBtn = $('logoutMenuBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('professorId');
      localStorage.removeItem('studentId');
      menuPanel.classList.remove('open');

      toast({ title: 'Saindo...', message: 'Você foi desconectado.', type: 'info', duration: 1200 });

      window.location.href = role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;
    });
  }

  // excluir conta (DELETE)
  const deleteBtn = $('deleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Excluir conta',
        message: 'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
        okText: 'Sim, excluir',
        cancelText: 'Cancelar',
      });
      if (!ok) return;

      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');
        localStorage.removeItem(photoKey(role, id));

        toast({ title: 'Conta excluída', message: 'Sua conta foi removida com sucesso.', type: 'success' });

        window.location.href = role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;
      } catch {
        toast({ title: 'Erro', message: 'Erro ao excluir conta.', type: 'error' });
      }
    });
  }
}
