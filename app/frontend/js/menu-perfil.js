import { API_URL } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function safeText(el, value, fallback = '—') {
  if (!el) return;
  el.textContent =
    value !== undefined && value !== null && String(value).trim() !== ''
      ? String(value)
      : fallback;
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
    img.style.display = 'inline-block';
  } else {
    img.removeAttribute('src');
    img.style.display = 'inline-block';
  }
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
    loginRedirect = 'login.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = options;

  const menuBtn = $('menuBtn');
  const menuPanel = $('menuPanel');
  const closeBtn = $('menuCloseBtn');

  // se a página nem tem menu, sai
  if (!menuBtn || !menuPanel) return;

  // evita duplicar listeners
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

  // ✅ NÃO exibir ID (se existir no HTML, deixa vazio)
  safeText($('meId'), '');

  // visitante
  if (!role || !id) {
    safeText($('meName'), 'Visitante');
    safeText($('meEmail'), '');
    safeText($('meRole'), '');
    loadPhoto(null, null);

    const logoutBtn = $('logoutMenuBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    const delBtn = $('deleteAccountBtn');
    if (delBtn) delBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    const saveBtn = $('saveProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    return;
  }

  safeText($('meRole'), role === 'professor' ? 'Professor' : 'Aluno');
  loadPhoto(role, id);

  // Foto local
  const photoInput = $('menuPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
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

  // busca nome/email
  (async () => {
    const me = await tryFetchMe(role, id);
    if (me) {
      safeText($('meName'), me.name);
      safeText($('meEmail'), me.email);
      // padroniza role, se vier do backend
      if (me.role) {
        safeText(
          $('meRole'),
          String(me.role).toUpperCase() === 'PROFESSOR' ? 'Professor' : 'Aluno'
        );
      }
    } else {
      safeText($('meName'), '—');
      safeText($('meEmail'), '—');
    }
  })();

  // salvar alterações
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
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) throw new Error();

        if (statusEl) statusEl.textContent = 'Dados atualizados.';
        if (newEmail) newEmail.value = '';
        if (newPass) newPass.value = '';
      } catch {
        if (statusEl) statusEl.textContent = 'Erro ao atualizar dados.';
      }
    });
  }

  // logout
  const logoutBtn = $('logoutMenuBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('professorId');
      localStorage.removeItem('studentId');
      menuPanel.classList.remove('open');

      window.location.href =
        role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;
    });
  }

  // excluir conta
  const deleteBtn = $('deleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.');
      if (!ok) return;

      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');
        localStorage.removeItem(photoKey(role, id));

        window.location.href =
          role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;
      } catch {
        alert('Erro ao excluir conta.');
      }
    });
  }
}
