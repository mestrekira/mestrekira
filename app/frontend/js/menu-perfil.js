import { API_URL } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function safeText(el, value, fallback = '—') {
  if (!el) return;
  el.textContent = value ? String(value) : fallback;
}

function getRoleAndId() {
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');
  if (professorId) return { role: 'professor', id: professorId };
  if (studentId) return { role: 'student', id: studentId };
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
    img.style.display = 'inline-block';
  } else {
    // fallback visual (não quebra)
    img.removeAttribute('src');
    img.style.display = 'inline-block';
  }
}

async function tryFetchMe(role, id) {
  // tenta buscar no backend, mas não depende disso
  try {
    const res = await fetch(`${API_URL}/users/${id}`);
    if (!res.ok) return null;
    const me = await res.json();
    return me;
  } catch {
    return null;
  }
}

export function initMenuPerfil(options = {}) {
  const {
    loginRedirect = 'login.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = options;

  const menuBtn = $('menuBtn');
  const menuPanel = $('menuPanel');
  const closeBtn = $('menuCloseBtn');

  // Se a página nem tem menu, não faz nada
  if (!menuBtn || !menuPanel) return;

  menuBtn.addEventListener('click', () => {
    menuPanel.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      menuPanel.classList.remove('open');
    });
  }

  const { role, id } = getRoleAndId();

  // Se não estiver logado, mantém menu simples e redireciona se tentar ações
  if (!role || !id) {
    safeText($('meName'), 'Visitante');
    safeText($('meEmail'), '');
    safeText($('meId'), '');
    safeText($('meRole'), '');
    loadPhoto(null, null);

    const logoutBtn = $('logoutMenuBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.location.href = loginRedirect;
      });
    }
    const delBtn = $('deleteAccountBtn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        window.location.href = loginRedirect;
      });
    }
    return;
  }

  // Preenche IDs básicos
  safeText($('meId'), id);
  safeText($('meRole'), role === 'professor' ? 'Professor' : 'Aluno');

  loadPhoto(role, id);

  // Foto local
  const photoInput = $('menuPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('Formato inválido. Use PNG ou JPG.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(photoKey(role, id), reader.result);
        loadPhoto(role, id);
      };
      reader.readAsDataURL(file);
    });
  }

  // Tenta buscar dados reais no backend
  (async () => {
    const me = await tryFetchMe(role, id);
    if (me) {
      safeText($('meName'), me.name);
      safeText($('meEmail'), me.email);
      // se backend retornar role:
      if (me.role) safeText($('meRole'), me.role === 'professor' ? 'Professor' : 'Aluno');
    } else {
      // fallback (não quebra)
      safeText($('meName'), '—');
      safeText($('meEmail'), '—');
    }
  })();

  // Salvar alterações (PATCH)
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
        return;
      }

      if (password && password.length < 8) {
        if (statusEl) statusEl.textContent = 'Senha deve ter no mínimo 8 caracteres.';
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) throw new Error();

        if (statusEl) statusEl.textContent = 'Dados atualizados.';
        if (newEmail) newEmail.value = '';
        if (newPass) newPass.value = '';

      } catch {
        if (statusEl) statusEl.textContent = 'Erro ao atualizar dados (backend pode não ter PATCH ainda).';
      }
    });
  }

  // Logout
  const logoutBtn = $('logoutMenuBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('professorId');
      localStorage.removeItem('studentId');

      window.location.href = role === 'professor'
        ? logoutRedirectProfessor
        : logoutRedirectStudent;
    });
  }

  // Excluir conta (DELETE)
  const deleteBtn = $('deleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.');
      if (!ok) return;

      try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');
        localStorage.removeItem(photoKey(role, id));

        window.location.href = role === 'professor'
          ? logoutRedirectProfessor
          : logoutRedirectStudent;

      } catch {
        alert('Erro ao excluir conta (backend pode não ter DELETE ainda).');
      }
    });
  }
}
