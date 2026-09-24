let currentEssayHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  loadUserData();
  loadEssayHistory();
  setupLanguagePreference();
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
      localStorage.setItem('foreignLanguage', selected);

      // Tenta atualizar no backend se a rota existir
      try {
        if (window.api.patch) {
          await window.api.patch('/users/me', { foreignLanguage: selected });
        }
      } catch (e) {
        // Silencioso se não houver endpoint exclusivo
      }

      alert('Preferência de Língua Estrangeira salva com sucesso!');
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
      if (container) container.innerHTML = '<p style="color: var(--text-muted);">Nenhuma redação encontrada.</p>';
      return;
    }

    const prompts = res.prompts || [];
    const submitted = prompts.filter((p) => p.isSubmitted);
    currentEssayHistory = submitted;

    // Atualiza indicadores
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
            <p style="color: #64748b; margin-bottom: 0.75rem;">Você ainda não enviou redações neste ciclo de 30 dias.</p>
            <a href="redacao.html" class="btn" style="padding: 0.45rem 1rem; font-size: 0.85rem;">Produzir Primeira Redação</a>
          </div>
        `;
      }
      return;
    }

    // Renderiza cada redação submetida
    if (container) {
      container.innerHTML = submitted
        .map(
          (p, idx) => `
        <div class="history-card">
          <div>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary, #2563eb); text-transform: uppercase;">
              Tema ${p.themeNumber}
            </span>
            <h4 style="margin: 0.2rem 0; color: #1e293b;">${p.title}</h4>
            <span style="font-size: 0.85rem; color: #64748b;">Avaliado pela banca inteligente do Gabarita PAES</span>
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
        Para consultar o texto e reenviar ou praticar outras propostas disponíveis no ciclo, acerte seus estudos através da aba <strong>Redação</strong>.
      </p>
    `;
  }

  if (modal) modal.style.display = 'flex';
};

window.closeModal = () => {
  const modal = document.getElementById('essay-modal');
  if (modal) modal.style.display = 'none';
};
