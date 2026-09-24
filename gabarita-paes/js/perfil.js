document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificação de autenticação
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Busca os dados atualizados DIRETO do banco de dados (API)
  try {
    let user = null;

    // Tenta buscar da rota /users/me do backend
    try {
      user = await window.api.get('/users/me');
      if (user) {
        // Atualiza o cache local para que outras páginas tenham acesso
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (e) {
      console.warn('[Perfil] Rota /users/me indisponível, usando cache local:', e.message);
      const userStr = localStorage.getItem('user');
      user = userStr ? JSON.parse(userStr) : null;
    }

    // Preenche os campos na tela com os dados reais
    if (user) {
      const nameEl = document.getElementById('profile-name');
      const emailEl = document.getElementById('profile-email');
      const courseEl = document.getElementById('profile-course');
      const langEl = document.getElementById('profile-lang');
      const headerNameEl = document.getElementById('user-name');

      if (nameEl) nameEl.innerText = user.name || 'Estudante';
      if (emailEl) emailEl.innerText = user.email || 'Não informado';
      
      // Suporta targetCourse ou course
      const cursoEscolhido = user.targetCourse || user.course || user.target_course;
      if (courseEl) courseEl.innerText = cursoEscolhido || 'Não informado';

      const linguaEscolhida = user.foreignLanguage || user.language;
      if (langEl) {
        langEl.innerText = linguaEscolhida === 'ESPANHOL' ? 'Língua Espanhola' : 'Língua Inglesa';
      }

      if (headerNameEl && user.name) {
        headerNameEl.innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (err) {
    console.error('[Perfil] Erro ao carregar informações do usuário:', err);
  }

  // 3. Status de assinatura
  try {
    const planStatus = await window.api.get('/payments/status');
    const badge = document.getElementById('plan-badge');
    const expiresEl = document.getElementById('profile-expires');
    const upgradeBox = document.getElementById('upgrade-box');

    if (planStatus && planStatus.isPremium) {
      if (badge) {
        badge.className = 'plan-badge plan-premium';
        badge.innerText = '⭐ PREMIUM ATIVO';
      }
      if (upgradeBox) upgradeBox.style.display = 'none';

      if (expiresEl) {
        if (planStatus.expiresAt) {
          const d = new Date(planStatus.expiresAt);
          expiresEl.innerText = `Até ${d.toLocaleDateString('pt-BR')}`;
        } else {
          expiresEl.innerText = 'Acesso Ilimitado';
        }
      }
    } else {
      if (badge) {
        badge.className = 'plan-badge plan-free';
        badge.innerText = 'PLANO GRATUITO (BETA)';
      }
      if (expiresEl) expiresEl.innerText = 'Acesso Básico';
      if (upgradeBox) upgradeBox.style.display = 'flex';
    }
  } catch (err) {
    console.warn('[Perfil] Status de pagamento não retornado:', err.message);
  }
});

// ========================================================
// 4. EXCLUSÃO DEFINITIVA DE CONTA
// ========================================================
window.confirmarExclusaoConta = async () => {
  const primeiraConfirmacao = confirm(
    'ATENÇÃO! Esta ação é irreversível.\n\n' +
    'Ao excluir sua conta, todas as suas respostas do simulado, ' +
    'redações corrigidas pela IA e colocações no ranking serão apagadas definitivamente.\n\n' +
    'Deseja mesmo prosseguir?'
  );

  if (!primeiraConfirmacao) return;

  const palavraSeguranca = prompt(
    'Para confirmar a exclusão definitiva, digite a palavra EXCLUIR em maiúsculas:'
  );

  if (palavraSeguranca !== 'EXCLUIR') {
    alert('Confirmação incorreta. O processo foi cancelado.');
    return;
  }

  const btn = document.getElementById('btn-delete-account');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Excluindo conta no servidor...';
  }

  try {
    // Chamada segura via window.api ou fetch nativo com token
    if (typeof window.api.delete === 'function') {
      await window.api.delete('/users/me');
    } else if (typeof window.api.request === 'function') {
      try {
        await window.api.request('/users/me', 'DELETE');
      } catch (e) {
        await window.api.request('/users/me', { method: 'DELETE' });
      }
    }

    alert('Sua conta e todos os dados vinculados foram excluídos com sucesso.');

    // Limpa credenciais locais
    if (window.api && typeof window.api.logout === 'function') {
      window.api.logout();
    } else {
      localStorage.clear();
      window.location.href = 'login.html';
    }
  } catch (err) {
    console.error('Falha ao excluir:', err);
    alert(err.message || 'Erro ao excluir conta. Verifique sua conexão e tente novamente.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🗑️ Excluir Minha Conta Permanentemente';
    }
  }
};
