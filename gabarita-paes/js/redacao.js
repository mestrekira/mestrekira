    btnMic.classList.remove('recording');
    btnMic.innerText = '🎙️ Ditar Redação por Voz';
  }
}

function setupCounter() {
  const textarea = document.getElementById('essay-text');
  const countSpan = document.getElementById('char-count');
  const submitBtn = document.getElementById('btn-submit-essay');

  if (textarea && countSpan) {
    textarea.addEventListener('input', () => {
      countSpan.innerText = `${textarea.value.length} caracteres (mínimo de 200)`;
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitEssay);
  }
}

async function submitEssay() {
  const textarea = document.getElementById('essay-text');
  const content = textarea ? textarea.value : '';

  if (!selectedPromptId) {
    alert('Selecione uma proposta de tema primeiro.');
    return;
  }
  if (content.trim().length < 200) {
    alert('A sua redação precisa ter no mínimo 200 caracteres para ser avaliada pela banca.');
    return;
  }

  const btn = document.getElementById('btn-submit-essay');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ O Corretor Inteligente está analisando sua redação...';
    btn.style.background = '#475569';
  }

  try {
    const res = await window.api.post('/essays/submit', {
      promptId: selectedPromptId,
      content,
    });

    displayResult(res);

    // Atualiza o estado do botão para concluído
    if (btn) {
      btn.disabled = true;
      btn.innerText = '✅ Redação Avaliada com Sucesso!';
      btn.style.background = 'var(--accent, #10b981)';
    }

    // Atualiza os temas no topo para exibir a nota atualizada
    await checkEssayStatus();
  } catch (error) {
    alert(error.message || 'Erro ao enviar redação.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Enviar para Correção Inteligente';
      btn.style.background = 'var(--primary, #2563eb)';
    }
  }
}

function displayResult(res) {
  const card = document.getElementById('result-card');
  if (!card) return;
  card.style.display = 'block';

  const totalScore = Number(res.totalScore ?? res.total_score ?? 0).toFixed(2);
  const resTotal = document.getElementById('res-total');
  if (resTotal) {
    resTotal.innerText = `${totalScore} / 10.0`;
  }

  const fb = res.aiFeedback ?? res.ai_feedback ?? res.feedback ?? {};

  // Presença do título e qualidade do título são julgamentos diferentes.
  const titleBadge = document.getElementById('title-badge-container');
  if (titleBadge) {
    const hasTitle = fb.has_title ?? res.has_title ?? true;
    const titleAnalysis = escapeHtml(fb.title_analysis || (hasTitle ? 'Título identificado na 1ª linha.' : 'Título não identificado.'));
    titleBadge.innerHTML = hasTitle
      ? `<span class="badge-title" style="background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe;">Título: ${titleAnalysis}</span>`
      : `<span class="badge-title badge-warning">⚠ ${titleAnalysis}</span>`;
  }

  // 2. Parecer Geral
  const resFeedback = document.getElementById('res-feedback');
  if (resFeedback) {
    resFeedback.innerText = fb.pedagogical_feedback || 'Redação avaliada de acordo com as diretrizes da banca examinadora.';
  }

  // 3. Critérios Analíticos
  const criteriaGrid = document.getElementById('criteria-grid');
  if (criteriaGrid) {
    const crit = res.criteria || {
      theme: res.critTheme ?? res.crit_theme ?? 0,
      cohesion: res.critCohesion ?? res.crit_cohesion ?? 0,
      coherence: res.critCoherence ?? res.crit_coherence ?? 0,
      genre: res.critGenre ?? res.crit_genre ?? 0,
      grammarNorm: res.critGrammarNorm ?? res.crit_grammar_norm ?? 0,
    };

    const details = fb.criteria_details || {};

    const items = [
      { num: 1, name: 'Atendimento ao Tema', score: crit.theme, det: details.theme },
      { num: 2, name: 'Coesão das Partes', score: crit.cohesion, det: details.cohesion },
      { num: 3, name: 'Coerência Argumentativa', score: crit.coherence, det: details.coherence },
      { num: 4, name: 'Tipo Dissertativo-Argumentativo', score: crit.genre, det: details.genre },
      { num: 5, name: 'Norma Padrão da Língua', score: crit.grammarNorm, det: details.grammar_norm },
    ];

    criteriaGrid.innerHTML = items
      .map((item) => `
      <div class="criterion-box">
        <div class="criterion-header">
          <strong>${item.num}. ${item.name}</strong>
          <span style="font-weight: 700; color: var(--primary, #2563eb);">${item.score == null ? '—' : Number(item.score).toFixed(2)} / 2.00</span>
        </div>
        <p style="margin: 0; font-size: 0.875rem; color: #475569;">
          ${formatText(item.det?.diagnosis || 'Análise detalhada não disponível para esta redação.')}
        </p>
        ${item.det?.student_quote ? `<div class="student-quote">“${formatText(item.det.student_quote)}”</div>` : ''}
        ${(item.det?.findings || []).map((finding) => `<div class="criterion-finding">
          <div class="student-quote">“${formatText(finding.student_quote)}”</div>
          <p><strong>O que ocorre:</strong> ${formatText(finding.explanation)}</p>
          <p><strong>${finding.kind === 'limitation' ? 'Por que afeta a nota:' : 'Contribuição para o critério:'}</strong> ${formatText(finding.effect)}</p>
          <p><strong>Como melhorar:</strong> ${formatText(finding.suggestion)}</p>
        </div>`).join('')}
        ${item.det?.tip ? `<div class="tip-box">💡 <strong>Próximo passo:</strong> ${formatText(item.det.tip)}</div>` : ''}
      </div>
    `)
      .join('');
  }

  // 4. Desvios Gramaticais
  const deviationsContainer = document.getElementById('deviations-container');
  const deviationsBody = document.getElementById('deviations-body');
  if (deviationsContainer && deviationsBody) {
    const list = fb.grammar_deviations || [];
    if (list.length > 0) {
      deviationsContainer.style.display = 'block';
      deviationsBody.innerHTML = list
        .map(
          (d) => `
        <tr>
          <td style="color: #b91c1c; font-style: italic;">“${formatText(d.original)}”</td>
          <td style="color: #15803d; font-weight: 500;">“${formatText(d.correction)}”</td>
          <td style="color: #475569;">${formatText(d.rule)}</td>
        </tr>
      `,
        )
        .join('');
    } else {
