import { API_URL } from './config.js';
import { authFetch, readErrorMessage } from './auth.js';

export function initAiReview({ getEssayId, feedback }) {
  const button = document.getElementById('analyzeEssayBtn');
  const status = document.getElementById('aiReviewStatus');
  const list = document.getElementById('aiReviewList');
  const apply = document.getElementById('applyAiReviewBtn');
  let generation = 0;
  let abort = null;
  let rows = [];
  const includeValidated = row => {
    if (!row.checked.checked || row.checked.disabled) return;
    if (!row.edit.value.trim()) {
      row.checked.checked = false;
      status.textContent = 'Preencha a observação antes de validá-la.';
      return;
    }
    const text = `${row.observation.competency} — ${row.observation.category}${row.observation.excerpt ? '\nTrecho: “' + row.observation.excerpt + '”' : ''}\n${row.edit.value.trim()}`;
    feedback.value = `${feedback.value.trim()}${feedback.value.trim() ? '\n\n' : ''}${text}`;
    feedback.dispatchEvent(new Event('input', { bubbles: true }));
    row.checked.disabled = true;
    row.edit.disabled = true;
    row.card.dataset.included = 'true';
    status.textContent = 'Observação validada e incluída nos comentários do professor. Edite ou remova o texto no campo de feedback, se necessário. Atribua as notas e salve a correção para publicar ao aluno.';
  };
  const reset = () => {
    generation++; abort?.abort(); abort = null;
    rows = []; list.replaceChildren(); apply.hidden = true; button.disabled = false;
    status.textContent = 'As sugestões ficam privadas até você revisá-las e salvar a correção.';
  };
  button.addEventListener('click', async () => {
    const essayId = getEssayId();
    if (!essayId) return;
    const requestGeneration = ++generation;
    abort?.abort(); abort = new AbortController();
    button.disabled = true; apply.hidden = true; list.replaceChildren(); rows = [];
    status.textContent = 'Analisando ortografia, norma padrão e competências…';
    try {
      const res = await authFetch(`${API_URL}/writing/${encodeURIComponent(essayId)}/analysis`, { method: 'POST', signal: abort.signal }, { redirectTo: 'login-professor.html' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível analisar.'));
      const data = await res.json();
      if (generation !== requestGeneration || getEssayId() !== essayId) return;
      if (!Array.isArray(data.observations) || !data.observations.length) throw new Error('A IA não retornou observações.');
      for (const observation of data.observations) {
        const card = document.createElement('article'); card.className = 'ai-review-card';
        const label = document.createElement('label');
        const checked = document.createElement('input'); checked.type = 'checkbox';
        label.append(checked, document.createTextNode(` Validar e incluir nos comentários — ${observation.competency} · ${observation.category}`));
        const excerpt = document.createElement('blockquote'); excerpt.textContent = observation.excerpt || 'Observação sobre um elemento ausente ou sobre o texto como um todo.';
        const edit = document.createElement('textarea'); edit.rows = 4;
        edit.setAttribute('aria-label', `Editar observação de ${observation.competency}`);
        edit.value = `${observation.observation}${observation.suggestion ? '\nSugestão: ' + observation.suggestion : ''}`;
        card.append(label, excerpt, edit); list.append(card);
        const row = { checked, edit, observation, card };
        rows.push(row);
        checked.addEventListener('change', () => includeValidated(row));
      }
      status.textContent = 'Edite cada observação antes de validá-la. Ao marcar a caixa, ela será incluída automaticamente nos comentários do professor. Nenhuma nota foi atribuída pela IA.';
      apply.hidden = true;
    } catch (error) {
      if (generation === requestGeneration && error.name !== 'AbortError') status.textContent = `${error.message} Você pode continuar a correção manualmente.`;
    } finally { if (generation === requestGeneration) button.disabled = false; }
  });
  // Compatibilidade com o botão presente no HTML anterior; não é necessário clicar nele.
  apply.hidden = true;
  apply.addEventListener('click', () => rows.forEach(includeValidated));
  return { reset };
}
