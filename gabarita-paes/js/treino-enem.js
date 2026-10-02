let practiceQuestions = [];
let activeDiscipline = '';
let filterOnlyPending = false;
let historyOpen = false;
let historyLoadToken = 0;
let practiceLoadToken = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function showPracticeNotice(message, isError = true) {
  const notice = document.getElementById('practice-notice');
  if (!notice) return;
  notice.textContent = message || '';
  notice.hidden = !message;
  notice.classList.toggle('error', isError);
}

function renderQuestionTable(table) {
  if (!table || !Array.isArray(table.headers) || !table.headers.length ||
    !Array.isArray(table.rows) || table.rows.some((row) => !Array.isArray(row) || row.length !== table.headers.length)) return '';
  return `<div class="question-table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(table.caption || 'Tabela da questão')}">
    <table class="question-table">
      ${table.caption ? `<caption>${escapeHtml(table.caption)}</caption>` : ''}
      <thead><tr>${table.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${table.source ? `<p class="question-source">${escapeHtml(table.source)}</p>` : ''}
  </div>`;
}

// Marcadores opcionais posicionam os recursos; questões antigas continuam válidas.
function renderQuestionContent(question) {
  const media = new Map();
  [question.imageUrl, question.imageUrlB].forEach((value, i) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return;
      const safe = escapeHtml(url.href);
      media.set(`imagem:${i + 1}`, `<figure class="question-figure"><a href="${safe}" target="_blank" rel="noopener noreferrer" title="Abrir imagem em tamanho original">
        <img src="${safe}" class="question-img" alt="Figura ${i + 1} da questão" loading="lazy"></a></figure>`);
    } catch { /* Questão sem imagem ou URL inválida. */ }
  });
  if (Array.isArray(question.tables)) question.tables.slice(0, 4).forEach((table, i) => {
    const html = renderQuestionTable(table);
    if (html) media.set(`tabela:${i + 1}`, html);
  });
  const used = new Set();
  const statement = String(question.statement || '');
  const marker = /\[\[(imagem|tabela):([1-9]\d*)\]\]/g;
  let output = '', last = 0, match;
  const text = (value) => value ? `<div class="question-statement">${escapeHtml(value).replace(/\n/g, '<br>')}</div>` : '';
  while ((match = marker.exec(statement))) {
    output += text(statement.slice(last, match.index));
    const key = `${match[1]}:${match[2]}`;
    if (media.has(key)) { output += media.get(key); used.add(key); }
    else output += text(match[0]);
    last = marker.lastIndex;
  }
  output += text(statement.slice(last));
  for (const [key, html] of media) if (!used.has(key)) output += html;
  return output;
}

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
  document.getElementById('btn-toggle-history')?.addEventListener('click', () => {
    historyOpen = !historyOpen;
    document.getElementById('history-panel').hidden = !historyOpen;
    const btn = document.getElementById('btn-toggle-history');
    btn.setAttribute('aria-expanded', String(historyOpen));
    btn.textContent = historyOpen ? 'Ocultar histórico' : 'Ver questões respondidas';
    if (historyOpen) loadHistory(1);
  });
  window.buscarNovasQuestoes();
});

async function loadHistory(page = 1) {
  const list = document.getElementById('history-list');
  const pages = document.getElementById('history-pages');
  if (!list || !pages || !historyOpen) return;
  const token = ++historyLoadToken;
  list.textContent = 'Carregando histórico...';
  pages.replaceChildren();
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (activeDiscipline) params.set('discipline', activeDiscipline);
    const data = await window.api.get(`/questions/practice/history?${params}`);
    if (token !== historyLoadToken || !historyOpen) return;
    if (!data.items?.length) {
      list.textContent = data.total ? 'Não há mais questões nesta página.' : 'Nenhuma questão respondida neste filtro.';
      return;
    }
    list.innerHTML = data.items.map((item) => `
      <details class="history-entry">
        <summary>${item.isCorrect ? '✅' : '❌'} ${escapeHtml(item.discipline)} · ${escapeHtml(item.topic || 'Conteúdo geral')}
          <small>— ENEM ${escapeHtml(item.year)} · Rodada ${escapeHtml(item.practiceRound || 1)} · ${escapeHtml(new Date(item.answeredAt).toLocaleString('pt-BR'))}</small></summary>
        <div class="history-detail">
          ${renderQuestionContent(item)}
          <ol type="A">${(item.options || []).map((option) =>
            `<li><strong>${escapeHtml(option.letter)}.</strong> ${escapeHtml(option.text)}</li>`).join('')}</ol>
          <div class="history-answer">Sua resposta: <strong>${escapeHtml(item.selectedLetter || '—')}</strong> ·
            Gabarito: <strong>${escapeHtml(item.correctLetter || '—')}</strong></div>
          <p><strong>Resolução comentada:</strong> ${escapeHtml(item.explanation || 'Explicação ainda não cadastrada.').replace(/\n/g, '<br>')}</p>
        </div>
      </details>`).join('');
    const maxPage = Math.ceil(data.total / data.pageSize);
    const prev = document.createElement('button');
    prev.className = 'btn btn-secondary';
    prev.textContent = 'Anterior';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => loadHistory(page - 1));
    const label = document.createElement('span');
    label.textContent = `Página ${page} de ${maxPage} · ${data.total} resposta(s)`;
    const next = document.createElement('button');
    next.className = 'btn btn-secondary';
    next.textContent = 'Próxima';
    next.disabled = page >= maxPage;
    next.addEventListener('click', () => loadHistory(page + 1));
    pages.append(prev, label, next);
  } catch (error) {
    if (token === historyLoadToken) list.textContent = error.message || 'Não foi possível carregar o histórico.';
  }
}

// ==========================================
// 1. Busca e Carregamento do Bloco
// ==========================================
window.buscarNovasQuestoes = async () => {
  const token = ++practiceLoadToken;
  showPracticeNotice('');
  const container = document.getElementById('practice-container');
  const banner = document.getElementById('practice-completion-banner');
  if (banner) banner.style.display = 'none';

  filterOnlyPending = false;
  document.getElementById('btn-filter-pending')?.classList.remove('active');
  window.practiceSelections = Object.create(null);
  practiceQuestions = [];
  atualizarProgressoTreino(0, 0);

  if (container) {
    container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">Buscando bloco de questões inéditas no acervo do ENEM...</div>`;
  }

  try {
    const url = activeDiscipline
      ? `/questions/practice?discipline=${encodeURIComponent(activeDiscipline)}&limit=10`
      : '/questions/practice?limit=10';

    const questions = await window.api.get(url);
    if (token !== practiceLoadToken) return;

    if (!questions || questions.length === 0) {
      const discipline = activeDiscipline;
      const status = discipline ? await window.api.get(`/questions/practice/status?discipline=${encodeURIComponent(discipline)}`) : null;
      if (token !== practiceLoadToken) return;
      if (container) {
        const finished = status?.canRestart === true;
        container.innerHTML = `<div class="card" style="text-align:center;padding:2rem;">
          <h3>${finished ? 'Você concluiu esta rodada!' : 'Nenhuma questão encontrada neste bloco'}</h3>
          <p>${finished ? 'Inicie outra rodada desta disciplina. Seu histórico e o progresso das demais matérias serão preservados.' : status?.pending > 0 ? 'Ainda há questões disponíveis. Gere um novo bloco.' : discipline ? 'Não há questões disponíveis desta disciplina para sua conta.' : 'Selecione uma disciplina para iniciar outra rodada.'}</p>
          ${finished ? `<button class="btn btn-primary" id="btn-restart-discipline">Iniciar nova rodada de ${escapeHtml(discipline)}</button>` : ''}
          <button class="btn btn-secondary" id="btn-show-completed-history">Ver histórico</button>
        </div>`;
        document.getElementById('btn-show-completed-history')?.addEventListener('click', () => {
          if (!historyOpen) document.getElementById('btn-toggle-history')?.click();
          else document.getElementById('history-panel')?.scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('btn-restart-discipline')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          if (button.disabled) return;
          button.disabled = true;
          button.textContent = 'Iniciando rodada...';
          try {
            await window.api.post('/questions/practice/restart', { discipline, currentRound: status.currentRound });
            if (token !== practiceLoadToken || activeDiscipline !== discipline) return;
            await window.buscarNovasQuestoes();
            showPracticeNotice('Nova rodada iniciada. Seu histórico foi preservado.', false);
          } catch (error) {
            if (token === practiceLoadToken) {
              showPracticeNotice(error.message || 'Não foi possível iniciar outra rodada.', true);
              button.disabled = false;
              button.textContent = `Iniciar nova rodada de ${discipline}`;
            }
          }
        });
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
    if (token !== practiceLoadToken) return;
    if (container) {
      container.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center;">
          ${escapeHtml(error.message || 'Erro ao carregar questões do ENEM.')}
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
const boundPracticeContainers = new WeakSet();
function bindPracticeActions(container) {
  if (boundPracticeContainers.has(container)) return;
  boundPracticeContainers.add(container);
  container.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-practice-action]');
    if (!target || !container.contains(target) || target.disabled) return;
    const { practiceAction, questionId, optionId } = target.dataset;
    if (practiceAction === 'select') window.selectPracticeOption(questionId, optionId);
    else if (practiceAction === 'submit') window.submitPracticeAnswer(questionId);
    else if (practiceAction === 'next') window.rolarParaQuestao(questionId);
  });
}

function renderPractice() {
  const container = document.getElementById('practice-container');
  if (!container) return;

  bindPracticeActions(container);
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
    <div class="card" id="practice-card-${escapeHtml(q.id)}">
      <div class="question-header">
        <span class="badge ${q.isAnswered ? (q.isCorrect ? 'badge-success' : 'badge-danger') : ''}">
          Questão ${practiceQuestions.indexOf(q) + 1} de ${practiceQuestions.length} • ENEM ${escapeHtml(q.year || '')} • ${escapeHtml(q.discipline)}
        </span>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(q.topic || '')}</span>
      </div>

      ${renderQuestionContent(q)}

      <div class="options-list" id="opts-${escapeHtml(q.id)}">
        ${q.options
          .map(
            (opt) => `
          <div class="option-item ${q.selectedOptionId === opt.id ? 'selected' : ''}" 
               data-practice-action="select" data-question-id="${escapeHtml(q.id)}" data-option-id="${escapeHtml(opt.id)}" 
               id="opt-${escapeHtml(opt.id)}">
            <span class="option-letter">${escapeHtml(opt.letter)}</span>
            <span class="option-text">${escapeHtml(opt.text)}</span>
          </div>
        `,
          )
          .join('')}
      </div>

      <button class="btn" id="btn-submit-${escapeHtml(q.id)}" 
              data-practice-action="submit" data-question-id="${escapeHtml(q.id)}"
              ${q.isSubmitting ? 'disabled' : ''}
              ${q.isAnswered ? 'style="display:none;"' : ''}>
        ${q.isSubmitting ? 'Corrigindo...' : 'Responder e Conferir'}
      </button>

      <!-- Feedback e Recomendações -->
      <div id="feedback-${escapeHtml(q.id)}" style="${q.isAnswered ? 'display:block;' : 'display:none;'} margin-top: 1rem;">
        ${q.isAnswered ? gerarHtmlFeedback(q) : ''}
      </div>
    </div>
  `,
    )
    .join('');
}

function gerarHtmlFeedback(q, nextQId = null) {
  return `
    <div style="padding: 1rem; border-radius: 6px; background: ${q.isCorrect ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${q.isCorrect ? '#bbf7d0' : '#fecaca'};">
      <strong style="color: ${q.isCorrect ? '#166534' : '#991b1b'};">
        ${q.isCorrect ? '✅ Resposta Correta!' : `❌ Resposta Incorreta. A alternativa correta é a letra (${escapeHtml(q.correctLetter || '')}).`}
      </strong>
      ${q.explanation ? `<p style="margin-top: 0.5rem; color: #334155; line-height: 1.5;"><strong>Resolução:</strong> ${escapeHtml(q.explanation).replace(/\n/g, '<br>')}</p>` : ''}

      ${nextQId ? `
        <div style="margin-top: 0.75rem; text-align: right;">
          <button class="next-q-btn" data-practice-action="next" data-question-id="${escapeHtml(nextQId)}">
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
window.practiceSelections = Object.create(null);
window.selectPracticeOption = (questionId, optionId) => {
  const question = practiceQuestions.find((item) => item.id === questionId);
  if (!question || question.isAnswered || question.isSubmitting || !question.options.some(option => option.id === optionId)) return;
  const optsContainer = document.getElementById(`opts-${questionId}`);
  if (!optsContainer) return;

  optsContainer.querySelectorAll('.option-item').forEach((el) => el.classList.remove('selected'));
  const target = document.getElementById(`opt-${optionId}`);
  if (target) target.classList.add('selected');

  window.practiceSelections[questionId] = optionId;
  question.selectedOptionId = optionId;
};

window.submitPracticeAnswer = async (questionId) => {
  const q = practiceQuestions.find((item) => item.id === questionId);
  if (!q || q.isAnswered || q.isSubmitting) return;
  const loadToken = practiceLoadToken;
  const selectedOptionId = window.practiceSelections[questionId];
  if (!selectedOptionId) {
    showPracticeNotice('Selecione uma alternativa antes de responder.');
    return;
  }
  q.isSubmitting = true;
  showPracticeNotice('');

  const btn = document.getElementById(`btn-submit-${questionId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Corrigindo...';
  }

  try {
    const res = await window.api.post('/questions/practice/answer', {
      questionId,
      selectedOptionId,
      practiceRound: q.practiceRound,
    });
    if (loadToken !== practiceLoadToken) return;

    if (btn) btn.style.display = 'none';

    // Atualiza na memória local
    if (q) {
      q.isAnswered = true;
      q.isCorrect = res.isCorrect;
      q.selectedOptionId = selectedOptionId;
      q.correctOptionId = res.correctOptionId;
      q.correctLetter = res.correctLetter;
      q.explanation = res.explanation;
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
    if (historyOpen) loadHistory(1);

    // Se completou todas as 10, rola para o topo suavemente
    if (answeredCount >= practiceQuestions.length) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 400);
    }

  } catch (error) {
    if (loadToken !== practiceLoadToken) return;
    showPracticeNotice(error.message || 'Erro ao enviar resposta.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Responder e Conferir';
    }
  } finally {
    q.isSubmitting = false;
  }
};

window.rolarParaQuestao = (questionId) => {
  const card = document.getElementById(`practice-card-${questionId}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// ==========================================
// 5. Filtros
// ==========================================
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
      if (historyOpen) loadHistory(1);
    });
  });
}
