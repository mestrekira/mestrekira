let practiceQuestions = [];
let activeDiscipline = '';
let filterOnlyPending = false;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // 1. Carrega nome do usuário no menu
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        const userEl = document.getElementById('user-name');
        if (userEl) userEl.innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Configura filtros e busca primeiro bloco
  setupFilters();
  window.buscarNovasQuestoes();
});

// ==========================================
// 1. Busca e Carregamento do Bloco
// ==========================================
window.buscarNovasQuestoes = async () => {
  const container = document.getElementById('practice-container');
  const banner = document.getElementById('practice-completion-banner');
  if (banner) banner.style.display = 'none';

  filterOnlyPending = false;
  window.practiceSelections = {};

  if (container) {
    container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">Buscando bloco de questões inéditas no acervo do ENEM...</div>`;
  }

  try {
    const url = activeDiscipline
      ? `/questions/practice?discipline=${encodeURIComponent(activeDiscipline)}&limit=10`
      : '/questions/practice?limit=10';

    const questions = await window.api.get(url);

    if (!questions || questions.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 2.5rem;">
            <h3>🎉 Você respondeu todas as questões disponíveis desta matéria!</h3>
            <p style="color: var(--text-muted); margin: 1rem 0;">Deseja reiniciar seu histórico para treinar novamente?</p>
            <button class="btn" onclick="reiniciarHistorico()">Reiniciar Histórico de ${activeDiscipline || 'Geral'}</button>
          </div>
        `;
      }
      atualizarProgressoTreino(0, 0);
      return;
    }

    // Inicializa estado das questões
    practiceQuestions = questions.map((q) => ({
      ...q,
      isAnswered: false,
      isCorrect: null,
      selectedOptionId: null,
    }));

    atualizarProgressoTreino(0, practiceQuestions.length);
    renderPractice();
  } catch (error) {
    if (container) {
      container.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center;">
          ${error.message || 'Erro ao carregar questões do ENEM.'}
        </div>
      `;
    }
  }
};

// ==========================================
// 2. Barra de Progresso e Conclusão
// ==========================================
function atualizarProgressoTreino(answered, total) {
  const progressText = document.getElementById('practice-progress-text');
  const progressBar = document.getElementById('practice-progress-bar');
  const pendingBtn = document.getElementById('btn-filter-pending');

  const acertos = practiceQuestions.filter((q) => q.isAnswered && q.isCorrect === true).length;
  const erros = practiceQuestions.filter((q) => q.isAnswered && q.isCorrect === false).length;
  const pendentes = practiceQuestions.filter((q) => !q.isAnswered).length;

  if (progressText) {
    progressText.innerText = `${answered} de ${total} respondidas (${acertos} acertos • ${erros} erros)`;
  }
  if (progressBar) {
    const percentage = total > 0 ? (answered / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
  }

  // Atualiza botão de pendentes no filtro
  if (pendingBtn) {
    pendingBtn.innerText = `⏳ Faltam (${pendentes})`;
    pendingBtn.style.display = pendentes > 0 && answered > 0 ? 'inline-block' : 'none';
  }

  // Se terminou as 10 questões do bloco
  if (answered >= total && total > 0) {
    exibirBannerConclusaoTreino(acertos, erros, total);
  }
}

function exibirBannerConclusaoTreino(acertos, erros, total) {
  const banner = document.getElementById('practice-completion-banner');
  if (!banner) return;

  const aproveitamento = Math.round((acertos / total) * 100);

  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="card" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #166534; font-size: 1.35rem; margin-bottom: 0.35rem;">🎉 Bloco de Treino Concluído!</h2>
      <p style="color: #15803d; font-size: 0.95rem; margin-bottom: 1.25rem;">
        Você finalizou as <strong>${total} questões</strong> deste bloco.<br>
        Aproveitamento: <strong>${acertos} acertos</strong> e <strong>${erros} erros</strong> (${aproveitamento}%).
      </p>
      <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
        <button onclick="buscarNovasQuestoes()" class="btn" style="background: #16a34a; font-weight: 700; color: white;">
          🔄 Gerar Novo Bloco (10Q)
        </button>
        <a href="simulado.html" class="btn" style="background: var(--primary); font-weight: 700; color: white; text-decoration: none;">
          📝 Ir ao Simulado PAES UEMA (60Q)
        </a>
        <a href="redacao.html" class="btn" style="background: #2563eb; font-weight: 700; color: white; text-decoration: none;">
          ✍️ Treinar Redação UEMA
        </a>
      </div>
    </div>
  `;
}

// ==========================================
// 3. Renderização das Questões
// ==========================================
function renderPractice() {
  const container = document.getElementById('practice-container');
  if (!container) return;

  const list = filterOnlyPending
    ? practiceQuestions.filter((q) => !q.isAnswered)
    : practiceQuestions;

  if (list.length === 0) {
    if (filterOnlyPending) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 2rem; color: #166534; background: #f0fdf4;">
          <h3>✓ Todas as questões deste bloco foram respondidas!</h3>
          <p style="margin-top: 0.5rem; color: #15803d;">Gere um novo bloco acima para continuar praticando.</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = list
    .map(
      (q, idx) => `
    <div class="card" id="practice-card-${q.id}">
      <div class="question-header">
        <span class="badge ${q.isAnswered ? (q.isCorrect ? 'badge-success' : 'badge-danger') : ''}">
          Questão ${idx + 1} de ${practiceQuestions.length} • ENEM ${q.year || ''} • ${q.discipline}
        </span>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${q.topic || ''}</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Imagem da questão">` : ''}
      ${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Imagem complementar">` : ''}

      <div class="options-list" id="opts-${q.id}">
        ${q.options
          .map(
            (opt) => `
          <div class="option-item ${q.selectedOptionId === opt.id ? 'selected' : ''}" 
               onclick="${q.isAnswered ? '' : `selectPracticeOption('${q.id}', '${opt.id}')`}" 
               id="opt-${opt.id}">
            <span class="option-letter">${opt.letter}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `,
          )
          .join('')}
      </div>

      <button class="btn" id="btn-submit-${q.id}" 
              onclick="submitPracticeAnswer('${q.id}')"
              ${q.isAnswered ? 'style="display:none;"' : ''}>
        Responder e Conferir
      </button>

      <!-- Feedback e Recomendações -->
      <div id="feedback-${q.id}" style="${q.isAnswered ? 'display:block;' : 'display:none;'} margin-top: 1rem;">
        ${q.isAnswered ? gerarHtmlFeedback(q) : ''}
      </div>
    </div>
  `,
    )
    .join('');
}

function gerarHtmlFeedback(q, nextQId = null) {
  let recsHtml = '';
  if (!q.isCorrect && q.recommendations && q.recommendations.length > 0) {
    recsHtml = `
      <div class="rec-box">
        <strong>💡 Recomendação de Estudo para este Assunto:</strong>
        ${q.recommendations
          .map(
            (r) => `
          <a href="${r.url}" target="_blank" class="rec-item">
            🔗 ${r.title}${r.sourceType === 'MESTRE_KIRA' ? '(Artigo Mestre Kira)' : ''}
          </a>
        `,
          )
          .join('')}
      </div>
    `;
  }

  return `
    <div style="padding: 1rem; border-radius: 6px; background: ${q.isCorrect ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${q.isCorrect ? '#bbf7d0' : '#fecaca'};">
      <strong style="color: ${q.isCorrect ? '#166534' : '#991b1b'};">
        ${q.isCorrect ? '✅ Resposta Correta!' : `❌ Resposta Incorreta. A alternativa correta é a letra (${q.correctLetter || ''}).`}
      </strong>
      ${q.explanation ? `<p style="margin-top: 0.5rem; color: #334155; line-height: 1.5;"><strong>Resolução:</strong> ${q.explanation}</p>` : ''}
      ${recsHtml}

      ${nextQId ? `
        <div style="margin-top: 0.75rem; text-align: right;">
          <button class="next-q-btn" onclick="rolarParaQuestao('${nextQId}')">
            Próxima Questão ➔
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// ==========================================
// 4. Seleção e Envio de Resposta
// ==========================================
window.practiceSelections = {};
window.selectPracticeOption = (questionId, optionId) => {
  const optsContainer = document.getElementById(`opts-${questionId}`);
  if (!optsContainer) return;

  optsContainer.querySelectorAll('.option-item').forEach((el) => el.classList.remove('selected'));
  const target = document.getElementById(`opt-${optionId}`);
  if (target) target.classList.add('selected');

  window.practiceSelections[questionId] = optionId;
};

window.submitPracticeAnswer = async (questionId) => {
  const selectedOptionId = window.practiceSelections[questionId];
  if (!selectedOptionId) {
    alert('Selecione uma alternativa antes de responder.');
    return;
  }

  const btn = document.getElementById(`btn-submit-${questionId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Corrigindo...';
  }

  try {
    const res = await window.api.post('/questions/practice/answer', {
      questionId,
      selectedOptionId,
    });

    if (btn) btn.style.display = 'none';

    // Atualiza na memória local
    const q = practiceQuestions.find((item) => item.id === questionId);
    if (q) {
      q.isAnswered = true;
      q.isCorrect = res.isCorrect;
      q.selectedOptionId = selectedOptionId;
      q.correctOptionId = res.correctOptionId;
      q.correctLetter = res.correctLetter;
      q.explanation = res.explanation;
      q.recommendations = res.recommendations || [];
    }

    // Pinta opções de verde e vermelho
    const optsContainer = document.getElementById(`opts-${questionId}`);
    if (optsContainer) {
      optsContainer.querySelectorAll('.option-item').forEach((optEl) => {
        optEl.onclick = null;
      });
    }

    const correctEl = document.getElementById(`opt-${res.correctOptionId}`);
    if (correctEl) {
      correctEl.style.borderColor = 'var(--accent)';
      correctEl.style.background = '#f0fdf4';
    }

    if (!res.isCorrect) {
      const wrongEl = document.getElementById(`opt-${selectedOptionId}`);
      if (wrongEl) {
        wrongEl.style.borderColor = 'var(--danger)';
        wrongEl.style.background = '#fef2f2';
      }
    }

    // Identifica próxima questão pendente do bloco
    const currentIdx = practiceQuestions.findIndex((item) => item.id === questionId);
    let nextPending = practiceQuestions.slice(currentIdx + 1).find((item) => !item.isAnswered);
    if (!nextPending) {
      nextPending = practiceQuestions.find((item) => !item.isAnswered);
    }

    // Exibe feedback com botão de avançar
    const feedbackBox = document.getElementById(`feedback-${questionId}`);
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      feedbackBox.innerHTML = gerarHtmlFeedback(q, nextPending ? nextPending.id : null);
    }

    // Atualiza barra de progresso
    const answeredCount = practiceQuestions.filter((item) => item.isAnswered).length;
    atualizarProgressoTreino(answeredCount, practiceQuestions.length);

    // Se completou todas as 10, rola para o topo suavemente
    if (answeredCount >= practiceQuestions.length) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 400);
    }

  } catch (error) {
    alert(error.message || 'Erro ao enviar resposta.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Responder e Conferir';
    }
  }
};

window.rolarParaQuestao = (questionId) => {
  const card = document.getElementById(`practice-card-${questionId}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// ==========================================
// 5. Filtros e Reinício de Histórico
// ==========================================
window.reiniciarHistorico = async () => {
  if (!confirm(`Deseja realmente reiniciar seu histórico de questões desta matéria?`)) return;

  try {
    await window.api.post('/questions/practice/reset-history', {
      discipline: activeDiscipline,
    });
    alert('Histórico reiniciado!');
    window.buscarNovasQuestoes();
  } catch (e) {
    alert(e.message || 'Erro ao reiniciar histórico.');
  }
};

function setupFilters() {
  const filterScroll = document.getElementById('disciplines-filter');

  // Adiciona botão "Faltam Responder" dinamicamente
  if (filterScroll && !document.getElementById('btn-filter-pending')) {
    const btnPending = document.createElement('button');
    btnPending.id = 'btn-filter-pending';
    btnPending.className = 'filter-btn';
    btnPending.style.cssText = 'background: #fffbeb; border-color: #fde68a; color: #b45309; font-weight: 700; display: none;';
    btnPending.innerText = '⏳ Faltam (0)';

    btnPending.addEventListener('click', () => {
      filterOnlyPending = !filterOnlyPending;
      btnPending.classList.toggle('active', filterOnlyPending);
      renderPractice();
    });

    const firstBtn = filterScroll.querySelector('.filter-btn');
    if (firstBtn && firstBtn.nextSibling) {
      filterScroll.insertBefore(btnPending, firstBtn.nextSibling);
    } else {
      filterScroll.appendChild(btnPending);
    }
  }

  const buttons = document.querySelectorAll('#disciplines-filter .filter-btn:not(#btn-filter-pending)');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiscipline = btn.getAttribute('data-discipline') || '';
      window.buscarNovasQuestoes();
    });
  });
}
