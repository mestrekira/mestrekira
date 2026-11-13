import { API_URL } from './config.js';
import { authFetch, readErrorMessage } from './auth.js';
import { confirmDialog } from './ui-feedback.js';

const COMPETENCIES = { C1: 'Escrita formal', C2: 'Tema, gênero e repertório', C3: 'Desenvolvimento dos argumentos', C4: 'Coesão e referenciação', C5: 'Proposta de intervenção' };
const ELEMENTS = { agent: 'Agente', action: 'Ação', means: 'Meio', purpose: 'Finalidade', detail: 'Detalhamento' };
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };

export function initAiReview({ getEssayId, feedback }) {
  const button = document.getElementById('analyzeEssayBtn'), status = document.getElementById('aiReviewStatus'), list = document.getElementById('aiReviewList'), apply = document.getElementById('applyAiReviewBtn');
  if (!button || !status || !list || !feedback) return { reset() {} };
  let generation = 0, abort = null, rows = [], result = null, report = null;
  if (apply) apply.hidden = true;
  function updateReport() {
    if (!report || !result) return;
    const lines = ['ANÁLISE PRELIMINAR — REVISÃO DOCENTE', result.analysisVersion ? `Versão: ${result.analysisVersion}` : '', result.summary || ''];
    for (const warning of result.warnings || []) lines.push(`Conferência necessária: ${warning}`);
    for (const [i, proposal] of (result.interventions || []).entries()) {
      lines.push(`\nC5 — Proposta ${i + 1}: elementos identificados pela IA`);
      for (const [key, name] of Object.entries(ELEMENTS)) lines.push(`${name}: ${proposal[key]?.status || 'incerto'}${proposal[key]?.excerpt ? ' — ' + proposal[key].excerpt : ''}`);
      if (proposal.comment) lines.push(proposal.comment);
    }
    for (const row of rows) lines.push(`\n${row.observation.competency} — ${row.observation.aspect || row.observation.category}\n${row.observation.nature || 'Revisão preliminar'} | Decisão: ${row.decision}\n${row.observation.excerpt ? 'Trecho: ' + row.observation.excerpt + '\n' : ''}${row.edit.value}`);
    report.textContent = lines.filter(Boolean).join('\n');
  }
  function include(row) {
    if (row.decision === 'incluída' || row.accept.disabled) return;
    if (!row.edit.value.trim()) { status.textContent = 'Preencha o comentário antes de incluí-lo.'; row.edit.focus(); return; }
    const o = row.observation, scope = o.competency === 'C5' && o.proposalIndex >= 0 ? ` · proposta ${o.proposalIndex + 1}` : '';
    const text = `${o.competency} — ${o.aspect || o.category}${scope}${o.excerpt ? '\nTrecho: “' + o.excerpt + '”' : ''}\n${row.edit.value.trim()}`;
    feedback.value = `${feedback.value.trim()}${feedback.value.trim() ? '\n\n' : ''}${text}`;
    feedback.dispatchEvent(new Event('input', { bubbles: true }));
    row.decision = 'incluída'; row.accept.disabled = true; row.reject.disabled = true; row.edit.disabled = true; row.card.dataset.decision = 'included';
    row.state.textContent = row.changed ? 'Comentário editado e incluído no feedback.' : 'Comentário validado e incluído no feedback.';
    status.textContent = 'Comentário incluído. Confira o feedback final, atribua as notas e salve a correção para disponibilizá-la ao estudante.'; updateReport();
  }
  function renderInterventions(data) {
    if (!Array.isArray(data.interventions) || !data.interventions.length) return;
    const audit = el('details', 'ai-audit'); audit.append(el('summary', '', 'C5 · Conferir os elementos da intervenção'));
    audit.append(el('p', 'ai-help', 'Este mapa é uma leitura preliminar da IA. Confira cada proposta inteira: “não identificado” exige verificação no texto e não significa automaticamente elemento ausente.'));
    data.interventions.forEach((proposal, index) => {
      const group = el('div', 'ai-proposal'); group.append(el('h5', '', `Proposta ${index + 1}`));
      const grid = el('dl', 'ai-evidence-grid');
      for (const [key, name] of Object.entries(ELEMENTS)) {
        const field = proposal[key] || { status: 'incerto', excerpt: '' }, box = el('div', 'ai-evidence'); box.dataset.evidenceStatus = field.status; box.append(el('dt', '', name));
        const value = el('dd'); value.append(el('span', 'ai-evidence-label', field.status === 'identificado' ? 'Trecho identificado' : field.status === 'não identificado' ? 'Não identificado pela IA' : 'Conferir com o professor'));
        if (field.excerpt) value.append(el('blockquote', '', field.excerpt)); box.append(value); grid.append(box);
      }
      group.append(grid); if (proposal.comment) group.append(el('p', 'ai-help', proposal.comment)); audit.append(group);
    }); list.append(audit);
  }
  function render(data) {
    result = data; rows = [];
    const top = el('div', 'ai-overview'); top.append(el('span', 'ai-kicker', 'Leitura preliminar · sem nota automática'));
    if (data.summary) top.append(el('p', '', data.summary)); top.append(el('p', 'ai-help', 'Valide apenas os comentários pertinentes. A citação mostra a passagem examinada; a interpretação também precisa ser conferida.')); list.append(top);
    if (Array.isArray(data.warnings) && data.warnings.length) {
      const warnings = el('div', 'ai-warnings'); warnings.setAttribute('role', 'note'); warnings.append(el('strong', '', 'Itens que precisam de conferência'));
      const items = el('ul'); for (const text of data.warnings) items.append(el('li', '', String(text))); warnings.append(items); list.append(warnings);
    }
    renderInterventions(data);
    for (const [code, name] of Object.entries(COMPETENCIES)) {
      const group = el('section', 'ai-competency'); group.setAttribute('aria-label', `${code} — ${name}`); group.append(el('h4', '', `${code} · ${name}`));
      const observations = data.observations.filter(o => o.competency === code);
      if (!observations.length) group.append(el('p', 'ai-help', 'Nenhuma observação validada disponível. Faça a leitura docente desta competência.'));
      for (const observation of observations) {
        const card = el('article', 'ai-review-card'), nature = observation.nature || (observation.category === 'atendimento' ? 'ponto forte' : 'verificação docente'); card.dataset.nature = nature;
        const head = el('div', 'ai-card-head'); head.append(el('span', 'ai-nature', nature), el('span', 'ai-category', observation.category)); card.append(head);
        card.append(el('h5', '', `${observation.aspect || COMPETENCIES[code]}${code === 'C5' && observation.proposalIndex >= 0 ? ' · proposta ' + (observation.proposalIndex + 1) : ''}`));
        if (observation.excerpt) card.append(el('blockquote', '', observation.excerpt));
        else card.append(el('p', 'ai-help', observation.basis === 'ausência' ? 'Alegação de elemento não identificado: confira o texto completo e o mapa C5 antes de validar.' : 'Observação global: confira a justificativa à luz do texto completo.'));
        const comment = el('div', 'ai-comment'); comment.append(el('strong', '', 'Leitura da IA'), el('p', '', observation.observation)); card.append(comment);
        if (observation.suggestion) { const suggestion = el('div', 'ai-suggestion'); suggestion.append(el('strong', '', 'Orientação de revisão'), el('p', '', observation.suggestion)); card.append(suggestion); }
        const editor = el('details', 'ai-edit-details'); editor.append(el('summary', '', 'Editar o comentário antes de incluir'));
        const edit = el('textarea', 'ai-review-edit'); edit.rows = 5; edit.setAttribute('aria-label', `Editar comentário ${observation.id || ''} de ${code}`); edit.value = `${observation.observation}${observation.suggestion ? '\nSugestão: ' + observation.suggestion : ''}`; editor.append(edit); card.append(editor);
        const actions = el('div', 'ai-card-actions'), accept = el('button', '', 'Validar e incluir'), reject = el('button', 'secondary', 'Não incluir'), state = el('p', 'ai-decision'); accept.type = 'button'; reject.type = 'button'; state.setAttribute('role', 'status');
        const row = { observation, edit, accept, reject, state, card, decision: 'pendente', changed: false };
        accept.addEventListener('click', () => include(row)); reject.addEventListener('click', () => {
          if (row.decision === 'incluída') return;
          row.decision = row.decision === 'não incluída' ? 'pendente' : 'não incluída'; card.dataset.decision = row.decision === 'pendente' ? '' : 'rejected'; accept.disabled = row.decision !== 'pendente'; reject.textContent = row.decision === 'pendente' ? 'Não incluir' : 'Reconsiderar';
          state.textContent = row.decision === 'pendente' ? 'Comentário novamente disponível para revisão.' : 'Comentário não incluído no feedback.'; updateReport();
        });
        edit.addEventListener('input', () => { row.changed = true; updateReport(); }); actions.append(accept, reject); card.append(actions, state); group.append(card); rows.push(row);
      } list.append(group);
    }
    const copy = el('details', 'ai-text-report'); copy.append(el('summary', '', 'Ver análise completa em texto para copiar')); report = el('pre'); report.tabIndex = 0; copy.append(report); list.append(copy); updateReport();
  }
  const reset = () => { generation++; abort?.abort(); abort = null; rows = []; result = null; report = null; list.replaceChildren(); if (apply) apply.hidden = true; button.disabled = false; status.textContent = 'As sugestões ficam privadas até você revisá-las e salvar a correção.'; };
  button.addEventListener('click', async () => {
    const essayId = getEssayId(); if (!essayId || button.disabled) return;
    const previousGeneration = generation;
    if (rows.length && !await confirmDialog({ title: 'Solicitar análise novamente?', message: 'Os cartões da análise serão substituídos. O texto já incluído no feedback será mantido.', okText: 'Continuar', cancelText: 'Manter análise' })) return;
    if (generation !== previousGeneration || getEssayId() !== essayId || button.disabled) return;
    const requestGeneration = ++generation; abort?.abort(); abort = new AbortController(); button.disabled = true; list.replaceChildren(); rows = []; result = null; report = null;
    status.textContent = 'Lendo o texto e conferindo as evidências das cinco competências…';
    try {
      const res = await authFetch(`${API_URL}/writing/${encodeURIComponent(essayId)}/analysis`, { method: 'POST', signal: abort.signal }, { redirectTo: 'login-professor.html' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível analisar.')); const data = await res.json();
      if (generation !== requestGeneration || getEssayId() !== essayId) return;
      if (!Array.isArray(data.observations)) throw new Error('A IA não retornou uma análise válida.'); render(data);
      status.textContent = 'Análise disponível para revisão docente. Inclua apenas comentários pertinentes; conferir a citação não substitui avaliar a interpretação.';
    } catch (error) { if (generation === requestGeneration && error.name !== 'AbortError') status.textContent = `${error.message} Você pode continuar a correção manualmente.`; }
    finally { if (generation === requestGeneration) button.disabled = false; }
  });
  return { reset };
}
