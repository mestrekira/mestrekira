import { API_URL } from './config.js';

function qs(id) {
  return document.getElementById(id);
}

function getCurrentUser() {
  // prioriza professor
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');

  if (professorId) return { role: 'professor', id: professorId };
  if (studentId) return { role: 'student', id: studentId };

  return null;
}

function photoKey(userId) {
  return `profilePhoto_${userId}`;
}

async function fetchMe(userId) {
  // Você já usa dados no localStorage em alguns fluxos,
  // mas aqui buscamos do backend para ficar confiável.
  // Se você não tiver GET /users/:id, o fallback abaixo cobre.
  try {
    const res = await fetch(`${API_URL}/users/${userId}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    // fallback mínimo
    return {
      id: userId,
      name: '(nome não carregado)',
      email: '(email não carregado)',
    };
  }
}

export async function initMenuPerfil(options = {}) {
  const {
    loginRedirect = 'login.html', // caso sem sessão
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = options;

  const who = getCurrentUser();
  if (!who) {
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

  // Guardas
  if (!menuBtn || !menuPanel) {
    console.error('Menu de perfil: HTML não encontrado.');
    return;
  }

  // ABRIR/FECHAR
  function openMenu() {
    menuPanel.classList.add('open');
  }
  function closeMenu() {
    menuPanel.classList.remove('open');
    if (menuStatus) menuStatus.textContent = '';
  }

  menuBtn.addEventListener('click', openMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  document.addEventListener('click', (e) => {
    // clique fora fecha
    if (!menuPanel.classList.contains('open')) return;
    const clickedInside = menuPanel.contains(e.target) || menuBtn.contains(e.target);
    if (!clickedInside) closeMenu();
  });

  // FOTO
  const savedPhoto = localStorage.getItem(photoKey(who.id));
  if (savedPhoto && photoImg) photoImg.src = savedPhoto;

  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0];
      if (!file) return;

      const okTypes = ['image/png', 'image/jpeg'];
      if (!okTypes.includes(file.type)) {
        alert('Use apenas PNG ou JPEG.');
        photoInput.value = '';
        return;
      }

      // Limite simples (2MB) para não lotar localStorage
      if (file.size > 2 * 1024 * 1024) {
        alert('Imagem muito grande. Use até 2MB.');
        photoInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        localStorage.setItem(photoKey(who.id), dataUrl);
        if (photoImg) photoImg.src = dataUrl;
        if (menuStatus) menuStatus.textContent = 'Foto atualizada.';
      };
      reader.readAsDataURL(file);
    });
  }

  // CARREGAR DADOS
  const me = await fetchMe(who.id);

  if (meName) meName.textContent = me.name || '—';
  if (meEmail) meEmail.textContent = me.email || '—';
  if (meId) meId.textContent = who.id;
  if (meRole) meRole.textContent = who.role === 'professor' ? 'Professor' : 'Aluno';

  // SALVAR EMAIL/SENHA
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
        const res = await fetch(`${API_URL}/users/${who.id}`, {
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

      if (who.role === 'professor') window.location.href = logoutRedirectProfessor;
      else window.location.href = logoutRedirectStudent;
    });
  }

  // EXCLUIR CONTA
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('Tem certeza que deseja excluir sua conta? Essa ação não pode ser desfeita.');
      if (!ok) return;

      try {
        const res = await fetch(`${API_URL}/users/${who.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        // limpa sessão + foto
        localStorage.removeItem(photoKey(who.id));
        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');

        alert('Conta excluída.');
        window.location.href = (who.role === 'professor') ? logoutRedirectProfessor : logoutRedirectStudent;
      } catch {
        alert('Erro ao excluir conta.');
      }
    });
  }
}
