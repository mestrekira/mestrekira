let currentEssayHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  loadUserData();
  loadEssayHistory();
  loadSimulationHistory();
  setupLanguagePreference();
  setupDeleteAccountListener();
});

// Carrega informações cadastrais do Aluno
function loadUserData() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const name = user.name || user.email?.split('@')[0] || 'Aluno';
    const email = user.email || '';
    const isPremium = !!user.isPremium;
    const language = user.foreignLanguage || localStorage.getItem('foreignLanguage') || 'INGLES';

    // Header
    const nameHeader = document.getElementById('user-name-header');
    const avatarHeader = document.getElementById('user-avatar-header');
    if (nameHeader) nameHeader.innerText = name.split(' ')[0];
    if (avatarHeader) avatarHeader.innerText = name.charAt(0).toUpperCase();

    // Card Perfil
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('profile-avatar');
    if (nameEl) nameEl.innerText = name;
    if (emailEl) emailEl.innerText = email;
    if (avatarEl) avatarEl.innerText = name.charAt(0).toUpperCase();

    // Badges de Plano e Idioma
    const planBadge = document.getElementById('plan-badge');
    const planCta = document.getElementById('plan-cta');
    if (planBadge) {
      if (isPremium) {
        planBadge.innerText = '⭐ Assinante Premium';
        planBadge.style.background = '#dcfce7';
        planBadge.style.color = '#166534';
        if (planCta) planCta.style.display = 'none';
      } else {
        planBadge.innerText = 'Plano Gratuito';
      }
    }

    const langBadge = document.getElementById('lang-badge');
    const selectLang = document.getElementById('select-language');
    if (langBadge) {
      langBadge.innerText = `Opção: ${language === 'ESPANHOL' ? 'Língua Espanhola' : 'Língua Inglesa'}`;
    }
    if (selectLang) {
      selectLang.value = language;
    }
  } catch (err) {
    console.error('Erro ao carregar dados do usuário:', err);
  }
}

// Configuração da Língua Estrangeira
function setupLanguagePreference() {
  const btn = document.getElementById('btn-save-lang');
  const select = document.getElementById('select-language');

  if (btn && select) {
    btn.addEventListener('click', async () => {
      const selected = select.value;
      try {
        const updated = await window.api.patch('/users/me', { foreignLanguage: selected });
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...user, ...updated, foreignLanguage: selected }));
        localStorage.setItem('foreignLanguage', selected);
        alert('Preferência de Língua Estrangeira salva com sucesso!');
      } catch (e) {
        alert(e.message || 'Não foi possível salvar a preferência.');
        return;
      }
      loadUserData();
    });
  }
}

// Carrega histórico e indicadores de Redação do ciclo
async function loadEssayHistory() {
  const container = document.getElementById('essays-history-container');
  const statEssays = document.getElementById('stat-essays');
  const statBest = document.getElementById('stat-best-essay');

  try {
    const res = await window.api.get('/essays/cycle-status');
    if (!res || !res.prompts) {
      if (container) container.innerHTML = '<p style="color: var(--text-muted, #64748b);">Nenhuma redação encontrada.</p>';
      return;
    }

    const prompts = res.prompts || [];
    const submitted = prompts.filter((p) => p.isSubmitted);
    currentEssayHistory = submitted;

    if (statEssays) statEssays.innerText = `${submitted.length} / 2`;

    let bestScore = 0;
    submitted.forEach((p) => {
      const s = Number(p.score || 0);
      if (s > bestScore) bestScore = s;
    });
    if (statBest) statBest.innerText = bestScore > 0 ? `${bestScore.toFixed(2)}` : '0.00';

    if (submitted.length === 0) {
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 8px;">
            <p style="color: #64748b; margin-bottom: 0.75rem;">Você ainda não enviou redações neste ciclo.</p>
            <a href="redacao.html" class="btn" style="padding: 0.45rem 1rem; font-size: 0.85rem;">Produzir Primeira Redação</a>
          </div>
        `;
      }
      return;
    }

    if (container) {
      container.innerHTML = submitted
        .map(
          (p) => `
        <div class="history-card">
          <div>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary, #2563eb); text-transform: uppercase;">
              Tema ${p.themeNumber}
            </span>
            <h4 style="margin: 0.2rem 0; color: #1e293b;">${p.title}</h4>
            <span style="font-size: 0.85rem; color: #64748b;">Avaliado nos 5 critérios da UEMA</span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <span style="font-size: 0.75rem; color: #64748b; display: block;">Nota Final</span>
              <strong style="font-size: 1.35rem; color: var(--accent, #10b981);">
                ${Number(p.score || 0).toFixed(2)} / 10.0
              </strong>
            </div>
            <button class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.45rem 0.85rem;" onclick="viewEssayDetails('${p.id}')">
              Ver Espelho
            </button>
          </div>
        </div>
      `,
        )
        .join('');
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `<p style="color: #ef4444;">Erro ao carregar histórico de redações: ${err.message}</p>`;
    }
  }
}

// Carrega histórico e indicadores de Simulado
async function loadSimulationHistory() {
  const container = document.getElementById('simulations-history-container');
  const statSimulations = document.getElementById('stat-simulations');
  const statBestSim = document.getElementById('stat-best-sim');

  let simData = null;
  try {
    const res = await window.api.get('/simulations/my-status');
    if (res && res.submitted) simData = res;
  } catch (e) {
    console.error('Não foi possível consultar o simulado:', e);
  }

  if (simData && (simData.score !== undefined || simData.submitted)) {
    const score = Number(simData.score || 0);
    const total = Number(simData.totalQuestions || 60);
    const perc = Math.round((score / total) * 100);

    if (statSimulations) statSimulations.innerText = '1';
    if (statBestSim) statBestSim.innerText = `${perc}%`;

    if (container) {
      container.innerHTML = `
        <div class="history-card">
          <div>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary, #2563eb); text-transform: uppercase;">
              Simulado Oficial PAES UEMA
            </span>
            <h4 style="margin: 0.2rem 0; color: #1e293b;">Tentativa Concluída</h4>
            <span style="font-size: 0.85rem; color: #64748b;">Ciclo: ${simData.cycleCode}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <span style="font-size: 0.75rem; color: #64748b; display: block;">Pontuação</span>
              <strong style="font-size: 1.35rem; color: var(--primary, #2563eb);">
                ${score} / ${total}
              </strong>
            </div>
            <a href="simulado.html" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.45rem 0.85rem; text-decoration: none;">
              Revisar Gabarito
            </a>
          </div>
        </div>
      `;
    }
  } else {
    if (statSimulations) statSimulations.innerText = '0';
    if (statBestSim) statBestSim.innerText = '--%';
    if (container) {
      container.innerHTML = '<p style="color: var(--text-muted, #64748b); font-size: 0.95rem;">Nenhum simulado finalizado neste ciclo.</p>';
    }
  }
}

// Exclusão Segura de Conta (Frontend + Backend)
function setupDeleteAccountListener() {
  const btnDelete = document.getElementById('btn-delete-account');
  if (!btnDelete) return;

  btnDelete.addEventListener('click', async () => {
    const firstConfirm = confirm(
      '⚠️ ATENÇÃO: Esta ação é definitiva e irreversível!\n\n' +
      'Ao confirmar, sua conta, dados cadastrais, notas de simulados e espelhos de redação serão totalmente excluídos do banco de dados.\n\n' +
      'Deseja prosseguir?'
    );
    if (!firstConfirm) return;

    const secondConfirm = prompt('Para confirmar a exclusão permanente da sua conta, digite exatamente a palavra EXCLUIR:');
    if (secondConfirm !== 'EXCLUIR') {
      alert('Operação cancelada. A palavra digitada não confere.');
      return;
    }

    btnDelete.disabled = true;
    btnDelete.innerText = 'Excluindo conta do sistema...';

    try {
      // Dispara a requisição DELETE para o backend NestJS
      const token = window.api.getToken ? window.api.getToken() : localStorage.getItem('token');
      const response = await fetch(`${window.api.BASE_URL || 'https://mestrekira-api.onrender.com'}/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro HTTP ${response.status}`);
      }

      // Limpa os dados de sessão apenas se o banco de dados confirmar a deleção
      localStorage.clear();
      alert('Sua conta e todos os registros foram excluídos com sucesso.');
      window.location.href = 'login.html';
    } catch (err) {
      console.error('Falha ao excluir conta:', err);
      alert('Não foi possível excluir a conta: ' + (err.message || 'Erro de conexão com o servidor.'));
      btnDelete.disabled = false;
      btnDelete.innerText = '🗑️ Excluir Minha Conta Permanentemente';
    }
  });
}

// Modal do Espelho
window.viewEssayDetails = (promptId) => {
  const prompt = currentEssayHistory.find((p) => p.id === promptId);
  if (!prompt) return;

  const modal = document.getElementById('essay-modal');
  const titleEl = document.getElementById('modal-theme-title');
  const scoreEl = document.getElementById('modal-score');
  const bodyEl = document.getElementById('modal-body-feedback');

  if (titleEl) titleEl.innerText = `Tema ${prompt.themeNumber}: ${prompt.title}`;
  if (scoreEl) scoreEl.innerText = `${Number(prompt.score || 0).toFixed(2)} / 10.0`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary, #2563eb); margin-bottom: 1rem;">
        <strong>Avaliação Registrada:</strong><br>
        Esta nota foi atribuída com base nos 5 critérios analíticos do PAES UEMA (Atendimento ao Tema, Coesão das Partes, Coerência Argumentativa, Atendimento ao Tipo Textual com Título e Norma da Língua Portuguesa).
      </div>
      <p style="color: #475569; font-size: 0.9rem;">
        Para consultar o texto e reenviar ou praticar outras propostas disponíveis no ciclo, acesse a aba <strong>Redação</strong>.
      </p>
    `;
  }

  if (modal) modal.style.display = 'flex';
};

window.closeModal = () => {
  const modal = document.getElementById('essay-modal');
  if (modal) modal.style.display = 'none';
};
