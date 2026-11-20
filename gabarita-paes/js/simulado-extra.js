(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e; };
  let attempt = null, index = 0, busy = false, essayBusy = false, loadedTheme = null;
  const drafts = Object.create(null);
  const notice = (message = '', error = false) => { $('extra-notice').textContent = message; $('extra-notice').hidden = !message; $('extra-notice').classList.toggle('error', error); };
  function safeImage(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
  }
  async function loadList() {
    const res = await window.api.get('/simulation-extras');
    if (!res) return;
    const host = $('extra-list'); host.replaceChildren();
    if (!res.items.length) { host.append(node('p', res.message || 'Não há simulados extras disponíveis neste ciclo.')); return; }
    res.items.forEach(extra => {
      const card = node('article', null, 'card'); card.append(node('h2', extra.title), node('p', `${extra.totalQuestions} questões · fora do ranking`), node('p', extra.message));
      if (!res.officialCompleted) { const link = node('a', 'Ir ao simulado oficial'); link.href = 'simulado.html'; card.append(link); }
      else if (!res.essaySubmitted) { const link = node('a', 'Enviar redação oficial'); link.href = 'redacao.html'; card.append(link); }
      const button = node('button', extra.status === 'COMPLETED' ? 'Ver resultado e redação extra' : extra.attemptId ? 'Continuar extra' : 'Iniciar extra', 'btn');
      button.type = 'button'; button.disabled = !extra.unlocked;
      button.addEventListener('click', async () => {
        if (busy) return; busy = true; button.disabled = true;
        try {
          const data = extra.attemptId ? await window.api.get(`/simulation-extras/attempts/${encodeURIComponent(extra.attemptId)}`) : await window.api.post(`/simulation-extras/${encodeURIComponent(extra.code)}/start`, {});
          if (data) { attempt = data; index = Math.max(0, data.questions.findIndex(q => !q.selectedLetter)); loadedTheme = null; render(); history.replaceState(null, '', `simulado-extra.html?attempt=${encodeURIComponent(data.id)}`); }
        } catch (e) { notice(e.message, true); } finally { busy = false; button.disabled = !extra.unlocked; if (attempt) renderQuestion(); }
      });
      card.append(button); host.append(card);
    });
  }
  async function loadHistory() {
    const res = await window.api.get('/simulation-extras/history');
    if (!res?.items?.length) return;
    const host = $('extra-history'); host.replaceChildren(); $('extra-history-section').hidden = false;
    res.items.forEach(item => {
      const row = node('p'); const link = node('a', `${item.title} — ${item.cycleCode}: ${item.status === 'COMPLETED' ? `${item.score}/${item.totalQuestions} acertos` : `${item.answeredCount}/${item.totalQuestions} respostas salvas`}`);
      link.href = `simulado-extra.html?attempt=${encodeURIComponent(item.id)}`; row.append(link); host.append(row);
    });
  }
  function render() {
    $('extra-exam').hidden = false;
    $('extra-title').textContent = attempt.title;
    $('extra-language').textContent = `Língua estrangeira desta tentativa: ${attempt.language === 'ESPANHOL' ? 'Espanhol' : 'Inglês'}.`;
    $('extra-instructions').textContent = attempt.instructions;
    $('extra-progress').textContent = `${attempt.answeredCount} de ${attempt.totalQuestions} respostas salvas.${attempt.canContinue === false ? ' Período do extra encerrado ou atividade desativada: apenas consulta.' : ''}`;
    const complete = attempt.status === 'COMPLETED';
    $('extra-result').textContent = complete ? `Resultado extra: ${attempt.score} acertos de ${attempt.totalQuestions}. Este desempenho não altera o ranking oficial.` : '';
    $('extra-areas').replaceChildren(...Object.entries(attempt.areas || {}).map(([name, value]) => node('li', `${name}: ${value.correct} acertos em ${value.total} questões.`)));
    $('extra-finish').hidden = complete || attempt.canContinue === false; $('extra-save').hidden = complete || attempt.canContinue === false;
    $('extra-finish').disabled = attempt.answeredCount !== attempt.totalQuestions;
    const navigation = $('extra-navigation'); navigation.replaceChildren();
    attempt.questions.forEach((q, i) => {
      const b = node('button', String(i + 1), q.selectedLetter ? 'saved' : ''); b.type = 'button';
      b.setAttribute('aria-label', `Questão ${i + 1}${q.selectedLetter ? ', resposta salva' : ', pendente'}`);
      b.setAttribute('aria-current', String(i === index));
      b.addEventListener('click', () => { index = i; renderQuestion(); renderNavigation(); }); navigation.append(b);
    });
    renderQuestion();
    $('extra-essay').hidden = !complete;
    if (complete) {
      const select = $('extra-theme'); const previous = select.value; select.replaceChildren();
      attempt.prompts.forEach(p => { const option = node('option', `Tema ${p.themeNumber}: ${p.title}`); option.value = String(p.themeNumber); select.append(option); });
      if (attempt.prompts.some(p => String(p.themeNumber) === previous)) select.value = previous;
      renderTheme();
    }
  }
  function renderNavigation() { [...$('extra-navigation').children].forEach((b, i) => b.setAttribute('aria-current', String(i === index))); }
  function renderQuestion() {
    const q = attempt.questions[index], host = $('extra-question'); host.replaceChildren();
    host.append(node('h3', `Questão ${index + 1} — ${q.discipline}`), node('p', q.statement, 'extra-text'));
    [q.imageUrl, q.imageUrlB].forEach((value, i) => {
      const src = value && safeImage(value); if (!src) return;
      const img = node('img', null, 'extra-image'); img.src = src; img.alt = `Imagem ${i + 1} da questão ${index + 1}`;
      img.addEventListener('error', () => { img.replaceWith(node('p', 'A imagem não carregou. Verifique sua conexão antes de responder.')); }, { once:true }); host.append(img);
    });
    const fieldset = node('fieldset'); fieldset.append(node('legend', 'Escolha uma alternativa'));
    q.options.forEach(o => {
      const label = node('label', null, 'extra-option'), radio = node('input'); radio.type = 'radio'; radio.name = 'extra-answer'; radio.value = o.letter;
      radio.checked = o.letter === q.selectedLetter; radio.disabled = !!q.selectedLetter || attempt.status === 'COMPLETED' || attempt.canContinue === false;
      label.append(radio, node('span', `${o.letter}) ${o.text}`)); fieldset.append(label);
    }); host.append(fieldset);
    if (q.selectedLetter) host.append(node('p', `Resposta salva: ${q.selectedLetter}.`));
    if (attempt.status === 'COMPLETED') { host.append(node('p', `Gabarito: ${q.correctLetter}. ${q.selectedLetter === q.correctLetter ? 'Você acertou.' : 'Revise esta questão.'}`), node('p', q.explanation, 'extra-text')); }
    $('extra-save').disabled = !!q.selectedLetter || busy;
    $('extra-previous').disabled = index === 0; $('extra-next').disabled = index === attempt.questions.length - 1;
  }
  async function refresh() {
    const data = await window.api.get(`/simulation-extras/attempts/${encodeURIComponent(attempt.id)}`);
    if (data) { attempt = data; render(); }
  }
  function rememberDraft() { if (loadedTheme !== null && !$('extra-content').readOnly) drafts[loadedTheme] = $('extra-content').value; }
  function renderTheme() {
    const number = Number($('extra-theme').value), prompt = attempt.prompts.find(p => p.themeNumber === number); if (!prompt) return;
    const saved = attempt.essays.find(e => e.themeNumber === number);
    const changed = loadedTheme !== number;
    if (changed) rememberDraft();
    loadedTheme = number;
    $('extra-theme-title').textContent = prompt.title; $('extra-motivators').textContent = prompt.motivationalTexts;
    if (changed || saved) $('extra-content').value = saved?.content || drafts[number] || '';
    $('extra-content').readOnly = !!saved;
    $('extra-counter').textContent = `${$('extra-content').value.length} caracteres. Mínimo: 200.`;
    const processing = saved?.status === 'PROCESSING' && !saved.canRetry;
    $('extra-submit-essay').disabled = attempt.canContinue === false || essayBusy || saved?.status === 'CORRECTED' || processing || (saved?.status === 'FAILED' && !saved.canRetry);
    $('extra-submit-essay').textContent = saved?.status === 'CORRECTED' ? 'Redação extra corrigida' : saved ? 'Tentar corrigir o texto salvo' : 'Enviar redação extra para correção';
    $('extra-essay-state').textContent = saved?.status === 'CORRECTED' ? 'Correção salva. Esta nota não altera o ranking.' : processing ? 'Correção em andamento. Aguarde e use “Consultar novamente”.' : saved ? (saved.canRetry ? 'Seu texto está salvo. Você pode tentar a correção novamente.' : 'Seu texto está salvo. Entre em contato com o suporte para conferir a correção.') : '';
    $('result-card').style.display = 'none';
    if (saved?.result) displayResult(saved.result);
  }
  async function initialize() {
    if (!window.api?.getToken()) { location.href = 'login.html'; return; }
    $('extra-logout').addEventListener('click', () => window.api.logout());
    $('extra-previous').addEventListener('click', () => { if (index > 0) { index--; renderQuestion(); renderNavigation(); } });
    $('extra-next').addEventListener('click', () => { if (index < attempt.questions.length - 1) { index++; renderQuestion(); renderNavigation(); } });
    $('extra-save').addEventListener('click', async () => {
      if (busy) return;
      const selected = document.querySelector('input[name="extra-answer"]:checked'); if (!selected) { notice('Selecione uma alternativa antes de salvar.', true); return; }
      busy = true; $('extra-save').disabled = true;
      try { const res = await window.api.post(`/simulation-extras/attempts/${encodeURIComponent(attempt.id)}/answers`, { order: attempt.questions[index].order, letter: selected.value }); if (res) { notice('Resposta salva. Você pode continuar ou sair e retomar depois.'); await refresh(); } }
      catch (e) { notice(e.message, true); } finally { busy = false; renderQuestion(); }
    });
    $('extra-finish').addEventListener('click', async () => {
      if (busy) return; busy = true; $('extra-finish').disabled = true;
      try { const res = await window.api.post(`/simulation-extras/attempts/${encodeURIComponent(attempt.id)}/finish`, {}); if (res) { attempt = res; render(); notice('Simulado extra concluído! Confira o resultado, revise os erros e pratique a redação extra.'); } }
      catch (e) { notice(e.message, true); } finally { busy = false; $('extra-finish').disabled = attempt.answeredCount !== attempt.totalQuestions; }
    });
    $('extra-theme').addEventListener('change', renderTheme);
    $('extra-content').addEventListener('input', () => { rememberDraft(); $('extra-counter').textContent = `${$('extra-content').value.length} caracteres. Mínimo: 200.`; });
    $('extra-refresh').addEventListener('click', async () => { try { rememberDraft(); await refresh(); notice('Informações atualizadas.'); } catch (e) { notice(e.message, true); } });
    $('extra-submit-essay').addEventListener('click', async () => {
      if (essayBusy) return;
      const content = $('extra-content').value; if (content.trim().length < 200) { notice('Escreva pelo menos 200 caracteres.', true); return; }
      essayBusy = true; $('extra-submit-essay').disabled = true; $('extra-theme').disabled = true; $('extra-content').readOnly = true; notice('Corrigindo sua redação extra. Aguarde; o processo pode levar alguns minutos.');
      try { await window.api.post(`/simulation-extras/attempts/${encodeURIComponent(attempt.id)}/essays`, { themeNumber: Number($('extra-theme').value), content }); notice('Correção extra concluída.'); }
      catch (e) { notice(e.message, true); }
      finally { essayBusy = false; $('extra-theme').disabled = false; try { await refresh(); } catch (e) { notice('Não foi possível consultar o resultado. Seu texto continua nesta tela; use “Consultar novamente”.', true); $('extra-submit-essay').disabled = false; } }
    });
    try {
      await Promise.all([loadList(), loadHistory()]); const id = new URLSearchParams(location.search).get('attempt');
      if (id && /^[a-f0-9-]{36}$/i.test(id)) { attempt = await window.api.get(`/simulation-extras/attempts/${encodeURIComponent(id)}`); if (attempt) render(); }
    } catch (e) { notice(`${e.message} Se seu acesso venceu, consulte a página de assinatura ou o suporte.`, true); }
  }
  document.addEventListener('DOMContentLoaded', initialize, { once:true });

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatText(value) { return escapeHtml(value).replace(/\n/g, '<br>'); }
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
      deviationsContainer.style.display = 'none';
    }
  }

  // 5. Auditoria do repertório usado e sugestão separada de obra
  const repBox = document.getElementById('repertoire-box');
  const repContent = document.getElementById('repertoire-content');
  if (repBox && repContent) {
    const used = Array.isArray(fb.repertoire_analysis) ? fb.repertoire_analysis : [];
    const rep = fb.uema_repertoire_connection || {};
    repBox.style.display = 'block';
    repContent.innerHTML = `
      ${used.length ? used.map((item) => `<div class="repertoire-finding">
        <strong>${escapeHtml(item.reference || 'Referência usada')} · ${item.status === 'inaccurate' ? 'Atribuição incorreta' : item.status === 'consistent' ? 'Atribuição coerente' : 'Verificação pendente'}</strong>
        <div class="student-quote">“${formatText(item.student_quote)}”</div>
        <p>${formatText(item.analysis)}</p>
        ${item.thematic_link ? `<p><strong>Relação com o tema:</strong> ${formatText(item.thematic_link)}</p>` : ''}
        <small>${formatText(item.verification_basis)}</small>
      </div>`).join('') : '<p>Nenhuma referência explícita foi identificada para conferir.</p>'}
      ${rep.book && rep.application ? `<div class="repertoire-suggestion"><strong>Sugestão para outra produção:</strong> ${escapeHtml(rep.book)} — ${formatText(rep.application)}</div>` : ''}
    `;
  }

  // 6. Pontos Fortes e Pontos de Atenção
  const strengthsList = document.getElementById('strengths-list');
  if (strengthsList) {
    const strengths = fb.strengths || [];
    strengthsList.innerHTML = strengths.map((s) => `<li>${formatText(s)}</li>`).join('');
  }

  const weaknessesList = document.getElementById('weaknesses-list');
  if (weaknessesList) {
    const weaknesses = fb.weaknesses || [];
    weaknessesList.innerHTML = weaknesses.map((w) => `<li>${formatText(w)}</li>`).join('');
  }

  // 7. Recomendações de Estudo
  const recBox = document.getElementById('recommendations-box');
  const recList = document.getElementById('recommendations-list');
  if (recBox && recList) {
    const recs = fb.study_recommendations || [];
    if (recs.length > 0) {
      recBox.style.display = 'block';
      recList.innerHTML = recs.map((r) => `<li>${formatText(r)}</li>`).join('');
    } else {
      recBox.style.display = 'none';
    }
  }


}

})();
