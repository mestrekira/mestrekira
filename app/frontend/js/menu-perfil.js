import { API_URL } from './config.js';

function qs(id) {
  return document.getElementById(id);
}

function getSession() {
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');

  if (professorId) return { role: 'professor', id: professorId };
  if (studentId) return { role: 'student', id: studentId };
  return null;
}

function photoKey(userId) {
  return `profilePhoto_${userId}`;
}

async function fetchUser(userId) {
  try {
    const res = await fetch(`${API_URL}/users/${userId}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { id: userId, name: '(não carregou)', email: '(não carregou)' };
  }
}

export async function initMenuPerfil(opts = {}) {
  const {
    loginRedirect = 'login.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = opts;

  const session = getSession();
  if (!session) {
    window.location.href = loginRedirect;
    return;
  }

  // ELEMENTOS
  const menuBtn = qs('menuBtn');
  const menuPanel = qs('menuPanel');
  const menuCloseBtn = qs('menuCloseBtn');

  const photoImg = qs('menuPhotoImg');
  const photoInput = qs('menuPhotoInput');

  const meName = qs('meName');
  const meEmail = qs('meEmail');
  const meId = qs('meId');
  const meRole = qs('meRole');

  const newEmail = qs('newEmail');
  const newPass = qs('newPass');
  const saveProfileBtn = qs('saveProfileBtn');
  const menuStatus = qs('menuStatus');

  const logoutBtn = qs('logoutMenuBtn');
  const deleteBtn = qs('deleteAccountBtn');

  if (!menuBtn || !menuPanel) {
    console.error('Menu de perfil: HTML não encontrado.');
    return;
  }

  // ABRIR/FECHAR
  const openMenu = () => menuPanel.classList.add('open');
  const closeMenu = () => {
    menuPanel.classList.remove('open');
    if (menuStatus) menuStatus.textContent = '';
  };

  menuBtn.addEventListener('click', openMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!menuPanel.classList.contains('open')) return;
    const inside = menuPanel.contains(e.target) || menuBtn.contains(e.target);
    if (!inside) closeMenu();
  });

  // FOTO
  const savedPhoto = localStorage.getItem(photoKey(session.id));
  if (savedPhoto && photoImg) photoImg.src = savedPhoto;

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (!file) return;

      const allowed = ['image/png', 'image/jpeg'];
      if (!allowed.includes(file.type)) {
        alert('Use apenas PNG ou JPEG.');
        photoInput.value = '';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        alert('Imagem muito grande. Use até 2MB.');
        photoInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        localStorage.setItem(photoKey(session.id), dataUrl);
        if (photoImg) photoImg.src = dataUrl;
        if (menuStatus) menuStatus.textContent = 'Foto atualizada.';
      };
      reader.readAsDataURL(file);
    });
  }

  // DADOS DO USUÁRIO
  const user = await fetchUser(session.id);

  if (meName) meName.textContent = user.name || '—';
  if (meEmail) meEmail.textContent = user.email || '—';
  if (meId) meId.textContent = session.id;
  if (meRole) meRole.textContent = session.role === 'professor' ? 'Professor' : 'Aluno';

  // ATUALIZAR EMAIL/SENHA
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const email = (newEmail?.value || '').trim();
      const password = newPass?.value || '';

      if (!email && !password) {
        if (menuStatus) menuStatus.textContent = 'Nada para atualizar.';
        return;
      }

      if (password && password.length < 8) {
        if (menuStatus) menuStatus.textContent = 'Senha deve ter no mínimo 8 caracteres.';
        return;
      }

      try {
        const res = await fetch(`${API_URL}/users/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email || undefined,
            password: password || undefined,
          }),
        });

        if (!res.ok) throw new Error();

        if (menuStatus) menuStatus.textContent = 'Dados atualizados com sucesso.';
        if (newEmail) newEmail.value = '';
        if (newPass) newPass.value = '';

        // atualiza texto exibido
        if (email && meEmail) meEmail.textContent = email;

      } catch {
        if (menuStatus) menuStatus.textContent = 'Erro ao atualizar dados.';
      }
    });
  }

  // LOGOUT
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('professorId');
      localStorage.removeItem('studentId');

      window.location.href =
        session.role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;
    });
  }

  // EXCLUIR CONTA
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('Tem certeza que deseja excluir sua conta? Essa ação não pode ser desfeita.');
      if (!ok) return;

      try {
        const res = await fetch(`${API_URL}/users/${session.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        localStorage.removeItem(photoKey(session.id));
        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');

        alert('Conta excluída.');
        window.location.href =
          session.role === 'professor' ? logoutRedirectProfessor : logoutRedirectStudent;

      } catch {
        alert('Erro ao excluir conta.');
      }
    });
  }
}
