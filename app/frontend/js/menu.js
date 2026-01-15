import { API_URL } from './config.js';

// Detecta perfil (professor ou aluno) pelo localStorage
const professorId = localStorage.getItem('professorId');
const studentId = localStorage.getItem('studentId');

const role = professorId ? 'professor' : 'student';
const userId = professorId || studentId;

// Se não tiver nenhum, não inicializa (ex: página pública)
if (!userId) {
  // não faz nada
} else {
  const menuBtn = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');

  const avatarImg = document.getElementById('avatarImg');
  const avatarInput = document.getElementById('avatarInput');

  const profileRole = document.getElementById('profileRole');
  const profileIdText = document.getElementById('profileIdText');

  const newEmail = document.getElementById('newEmail');
  const newPassword = document.getElementById('newPassword');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const profileStatus = document.getElementById('profileStatus');

  const logoutBtn = document.getElementById('logoutBtn');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');

  // Segurança: elementos existem?
  if (!menuBtn || !menuPanel) {
    console.warn('Menu não encontrado nesta página.');
  } else {
    // Texto básico
    if (profileRole) profileRole.textContent = role === 'professor' ? 'Professor' : 'Aluno';
    if (profileIdText) profileIdText.textContent = `ID: ${userId}`;

    // Toggle menu
    menuBtn.addEventListener('click', () => {
      menuPanel.classList.toggle('open');
    });

    // Avatar (LocalStorage)
    const avatarKey = `avatar_${role}_${userId}`;
    if (avatarImg) {
      const saved = localStorage.getItem(avatarKey);
      if (saved) avatarImg.src = saved;
    }

    if (avatarInput) {
      avatarInput.addEventListener('change', () => {
        const file = avatarInput.files?.[0];
        if (!file) return;

        const okType = file.type === 'image/png' || file.type === 'image/jpeg';
        if (!okType) {
          alert('Formato inválido. Use PNG ou JPG.');
          avatarInput.value = '';
          return;
        }

        // Limite simples para não explodir localStorage
        if (file.size > 700 * 1024) {
          alert('Arquivo muito grande. Use uma imagem menor (até ~700KB).');
          avatarInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          localStorage.setItem(avatarKey, String(dataUrl));
          if (avatarImg) avatarImg.src = String(dataUrl);
        };
        reader.readAsDataURL(file);
      });
    }

    // Salvar perfil (stub preparado para backend)
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', async () => {
        const email = newEmail?.value?.trim();
        const password = newPassword?.value;

        if (!email && !password) {
          if (profileStatus) profileStatus.textContent = 'Nada para atualizar.';
          return;
        }

        // ✅ Aqui vamos implementar de verdade na próxima etapa (backend /users/:id)
        // Por enquanto, deixa claro pro usuário (para não parecer quebrado).
        if (profileStatus) {
          profileStatus.textContent =
            'Atualização de e-mail/senha será ativada na próxima etapa do backend.';
        }
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('professorId');
        localStorage.removeItem('studentId');
        window.location.href = role === 'professor' ? 'login-professor.html' : 'login-aluno.html';
      });
    }

    // Excluir conta (stub preparado)
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', async () => {
        const ok = confirm('Tem certeza que deseja excluir sua conta? Isso apagará seus dados.');
        if (!ok) return;

        // ✅ Próxima etapa: endpoint DELETE /users/:id (com limpeza)
        alert('Exclusão de conta será ativada na próxima etapa do backend.');
      });
    }
  }
}
