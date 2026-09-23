document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificação defensiva de autenticação
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Carrega os dados básicos do usuário do localStorage
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user) {
      const nameEl = document.getElementById('profile-name');
      const emailEl = document.getElementById('profile-email');
      const courseEl = document.getElementById('profile-course');
      const langEl = document.getElementById('profile-lang');
      const headerNameEl = document.getElementById('user-name');

      if (nameEl) nameEl.innerText = user.name || 'Estudante';
      if (emailEl) emailEl.innerText = user.email || 'Não informado';
      if (courseEl) courseEl.innerText = user.targetCourse || 'Não informado';
      if (langEl) {
        langEl.innerText = user.foreignLanguage === 'ESPANHOL' ? 'Língua Espanhola' : 'Língua Inglesa';
      }
      if (headerNameEl && user.name) {
        headerNameEl.innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (err) {
    console.error('[Perfil] Erro ao ler dados locais do usuário:', err);
  }

  // 3. Consulta o status real da assinatura no backend
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
    console.warn('[Perfil] Não foi possível obter status de pagamento:', err.message);
  }
});

// ========================================================
// 4. FUNÇÃO DE EXCLUSÃO DEFINITIVA DE CONTA (LGPD)
// ========================================================
window.confirmarExclusaoConta = async () => {
  // Primeira confirmação: Alerta sobre a gravidade da ação
  const primeiraConfirmacao = confirm(
    'ATENÇÃO! Esta ação é irreversível.\n\n' +
    'Ao excluir sua conta, todas as suas respostas do simulado oficial, ' +
    'redações corrigidas pela IA e colocações no ranking serão apagadas para sempre.\n\n' +
    'Deseja mesmo prosseguir?'
  );

  if (!primeiraConfirmacao) return;

  // Segunda confirmação: Digitação obrigatória da palavra de segurança
  const palavraSeguranca = prompt(
    'Para confirmar a exclusão definitiva de todos os seus dados, digite a palavra EXCLUIR em maiúsculas:'
  );

  if (palavraSeguranca !== 'EXCLUIR') {
    alert('Confirmação incorreta. O processo de exclusão foi cancelado com segurança.');
    return;
  }

  const btn = document.getElementById('btn-delete-account');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Excluindo conta e limpando dados...';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
  }

  try {
    // Chamada à rota DELETE /users/me do backend
    if (typeof window.api.delete === 'function') {
      await window.api.delete('/users/me');
    } else {
      await window.api.request('/users/me', { method: 'DELETE' });
    }

    alert('Sua conta e todos os seus dados associados foram excluídos com sucesso.');

    // Limpa credenciais locais e desloga
    if (window.api && typeof window.api.logout === 'function') {
      window.api.logout();
    } else {
      localStorage.clear();
      window.location.href = 'login.html';
    }
  } catch (err) {
    alert(err.message || 'Erro ao processar a exclusão da conta. Tente novamente mais tarde.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🗑️ Excluir Minha Conta Permanentemente';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
};
