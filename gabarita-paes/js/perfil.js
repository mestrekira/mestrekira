let currentAccess = null;
let accessLoading = false;
const PROFILE_PAID_START = Date.parse('2026-10-22T03:00:00.000Z');
const PROFILE_DAY = 24 * 60 * 60 * 1000;
function profileDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function profileDateLabel(time) {
  return new Date(time).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) + ' (horário de Brasília)';
}
function renderProfileAccess(user, access, now = Date.now()) {
  const panel = profileNode('account-access');
  if (!panel) return;
  const premiumUntil = profileDate(access?.premiumEndsAt);
  const schoolUntil = profileDate(access?.schoolEndsAt);
  const premiumActive = user?.planTier === 'PREMIUM' && premiumUntil !== null && premiumUntil > now;
  const schoolActive = schoolUntil !== null && schoolUntil > now;
  let title, text, detail = '', badge = 'Conta cadastrada', action = null, state = 'info';
  if (!access) {
    title = 'Seu acesso';
    text = 'A validade do acesso não foi atualizada nesta consulta. Use “Atualizar desempenho” para consultar novamente ou entre em contato com o suporte.';
  } else if (premiumActive) {
    badge = 'Assinatura ativa'; title = 'Assinatura ativa';
    text = `Acesso integral válido até ${profileDateLabel(premiumUntil)}.`;
    const remaining = premiumUntil - now;
    const days = Math.ceil(remaining / PROFILE_DAY);
    if (remaining <= 5 * PROFILE_DAY) {
      state = 'renewal'; title = days === 1 ? 'Sua assinatura vence em até 1 dia' : `Sua assinatura vence em até ${days} dias`;
    }
    detail = 'Você pode renovar antes do vencimento. Os novos 30 dias serão somados à validade atual, sem perder os dias restantes. Não há renovação automática.';
    action = now >= PROFILE_PAID_START ? 'Renovar acesso' : 'Consultar assinatura';
    if (now < PROFILE_PAID_START) detail += ' A cobrança comercial estará disponível a partir de 22/10/2026.';
  } else if (schoolActive) {
    badge = 'Participante do projeto escolar'; title = 'Acesso escolar ativo';
    text = `Acesso integral garantido até ${profileDateLabel(schoolUntil)}, sem cobrança automática.`;
  } else if (access.accessReason === 'TEMPORARY_FREE' && now < PROFILE_PAID_START) {
    badge = 'Participante da fase gratuita'; title = 'Acesso geral gratuito até 21/10/2026';
    text = 'Continue praticando com acesso completo até 21/10. A partir de 22/10/2026, o acesso integral custará R$ 24,99 por 30 dias. Não haverá cobrança automática.';
    action = 'Consultar assinatura';
  } else if (access.canAccess === true) {
    badge = 'Acesso integral disponível'; title = 'Acesso integral disponível';
    text = 'Seu acesso está liberado conforme a condição informada pelo servidor.';
    const trialEnd = profileDate(access.trialEndsAt);
    if (access.accessReason === 'TRIAL' && trialEnd !== null) text = `Período de teste válido até ${profileDateLabel(trialEnd)}.`;
  } else if (access.canAccess === false) {
    state = 'expired'; badge = 'Acesso gratuito ENEM';
    const expiredPaid = user?.planTier === 'PREMIUM' && premiumUntil !== null && premiumUntil <= now;
    title = expiredPaid ? 'Sua assinatura venceu' : 'Acesso integral indisponível';
    text = expiredPaid ? `A assinatura venceu em ${profileDateLabel(premiumUntil)}. Renove para retomar o acesso integral.` : 'Assine para acessar simulados PAES, redação, ranking e todo o banco ENEM.';
    detail = 'Você pode continuar praticando com a seleção gratuita de 50% do banco ENEM.';
    action = expiredPaid ? 'Renovar acesso' : 'Assinar por R$ 24,99';
  } else {
    title = 'Seu acesso'; text = 'Atualize o perfil para consultar a validade do acesso.';
  }
  profileText('plan-badge', badge);
  profileText('school-benefit', schoolActive ? `Benefício escolar válido até ${profileDateLabel(schoolUntil)}. Este benefício é preservado mesmo ao renovar uma assinatura.` : '');
  profileNode('plan-cta').hidden = true;
  panel.replaceChildren(); panel.dataset.accessState = state;
  const copy = document.createElement('div'); copy.className = 'account-access-copy';
  const heading = document.createElement('h2'); heading.textContent = title;
  const paragraph = document.createElement('p'); paragraph.textContent = text;
  copy.append(heading, paragraph);
  if (detail) { const note = document.createElement('p'); note.textContent = detail; copy.append(note); }
  panel.append(copy);
  if (action) {
    const actions = document.createElement('div'); actions.className = 'account-access-actions';
    const link = document.createElement('a'); link.className = 'btn'; link.href = 'assinatura.html'; link.textContent = action;
    actions.append(link); panel.append(actions);
  }
  panel.hidden = false;
}
async function loadProfileAccess() {
  if (accessLoading) return;
  accessLoading = true;
  try {
    // Endpoint existente: consulta somente a situação do plano, sem gerar cobrança.
    const status = await window.api.get('/payments/status');
    currentAccess = status && typeof status.canAccess === 'boolean' ? status : null;
  } catch (_) { currentAccess = null; }
  finally { accessLoading = false; renderProfileAccess(currentProfile, currentAccess); }
}

let currentEssayHistory = [];
let profileHistoryCycle = '';
let historyLoadToken = 0;
let historyReviewToken = 0;
const profileHistoryQuery = () => profileHistoryCycle ? `?cycle=${encodeURIComponent(profileHistoryCycle)}` : '';
async function loadProfileCycles() {
  const select = profileNode('profile-history-cycle');
  try {
    const data = await window.api.get('/simulations/cycles');
    if (!data || !Array.isArray(data.cycles)) throw new Error('Lista de ciclos indisponível.');
    select.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = 'Todos os ciclos'; select.append(all);
    for (const cycle of data.cycles) {
      const option = document.createElement('option'); option.value = cycle.cycleCode;
      option.textContent = `${cycle.title || cycle.cycleCode}${cycle.isCurrent ? ' — ciclo atual' : ' — histórico'}`;
      select.append(option);
    }
    if (profileHistoryCycle && !data.cycles.some(c => c.cycleCode === profileHistoryCycle)) profileHistoryCycle = '';
    select.value = profileHistoryCycle; select.disabled = false;
    profileText('profile-history-status', profileHistoryCycle ? `Exibindo o ciclo ${profileHistoryCycle}.` : 'Exibindo os registros disponíveis de todos os ciclos.');
  } catch (_) {
    select.disabled = true;
    profileText('profile-history-status', 'Não foi possível atualizar a lista de ciclos. Tentando consultar o histórico salvo; use Atualizar desempenho para tentar novamente.');
  }
}
async function refreshProfileHistory() {
  const token = ++historyLoadToken;
  currentEssayHistory = [];
  for (const id of ['stat-essays','stat-best-essay','stat-simulations','stat-best-sim']) profileText(id, '—');
  profileText('essays-history-container', 'Consultando redações salvas...');
  profileText('simulations-history-container', 'Consultando simulados salvos...');
  await Promise.allSettled([loadEssayHistory(token), loadSimulationHistory(token)]);
}
let currentProfile = null;
let correctionLoad = 0;
let performanceLoading = false;
const profileNode = (id) => document.getElementById(id);
const profileEscape = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const profileScore = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
function profileText(id, value) { const node = profileNode(id); if (node) node.textContent = value; }
function profileNotice(message, error = false) {
  const node = profileNode('profile-notice');
  node.textContent = message; node.hidden = !message; node.dataset.error = String(error);
}

function applyProfile(user) {
  const name = user.name || 'Aluno';
  profileText('user-name-header', name.trim().split(/\s+/)[0]);
  profileText('user-avatar-header', name.charAt(0).toUpperCase());
  profileText('profile-name', name); profileText('profile-email', user.email || '');
  profileText('profile-avatar', name.charAt(0).toUpperCase());
  renderProfileAccess(user, currentAccess);
  currentProfile = user;
  const language = user.foreignLanguage;
  if (['INGLES','ESPANHOL'].includes(language)) {
    profileText('lang-badge', `Opção: ${language === 'ESPANHOL' ? 'Língua Espanhola' : 'Língua Inglesa'}`);
    profileNode('select-language').value = language;
    profileNode('select-language').disabled = false;
    profileNode('btn-save-lang').disabled = false;
  } else {
    profileText('lang-badge', 'Atualize o perfil para conferir seu idioma');
  }
}

async function loadUserData() {
  if (performanceLoading) return;
  performanceLoading = true;
  profileNode('refresh-performance').disabled = true;
  try {
    const user = await window.api.get('/users/me');
    if (!user) return;
    currentProfile = user;
    applyProfile(user);
    await loadProfileAccess();
    localStorage.setItem('user', JSON.stringify(user));
    profileNotice('');
  } catch (error) {
    profileText('profile-name','Não foi possível carregar o perfil');
    profileText('profile-email','Atualize a página para tentar novamente.');
    currentAccess = null;
    renderProfileAccess(null, null);
    profileNotice('Seus dados cadastrais não foram atualizados. Você pode tentar novamente pelo botão abaixo.',true);
  } finally {
    // Cada módulo consulta o servidor independentemente dos metadados de assinatura.
    await loadProfileCycles();
    await Promise.allSettled([refreshProfileHistory(), loadEnemPerformance()]);
    performanceLoading = false;
    profileNode('refresh-performance').disabled = false;
  }
}

function setupLanguagePreference() {
  const button = profileNode('btn-save-lang');
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const select = profileNode('select-language');
    const selected = select.value;
    button.disabled = true; select.disabled = true;
    try {
      const updated = await window.api.patch('/users/me', {foreignLanguage:selected});
      if (!updated) return;
      // O perfil retornado pelo servidor é a fonte da preferência.
      const fresh = { ...currentProfile, ...updated.user };
      if (!updated.user?.foreignLanguage) throw new Error('A resposta do servidor não confirmou o idioma. Atualize a página.');
      applyProfile(fresh);
      localStorage.setItem('user',JSON.stringify(fresh));
      localStorage.removeItem('foreignLanguage');
      profileNotice('Preferência de língua estrangeira salva. Confira o idioma antes de iniciar o simulado.');
      await Promise.allSettled([refreshProfileHistory(),loadEnemPerformance()]);
    } catch (error) {
      if (currentProfile) select.value = currentProfile.foreignLanguage;
      profileNotice(error.message || 'Não foi possível salvar sua preferência.',true);
    } finally { button.disabled = false; select.disabled = false; }
  });
}

async function loadEnemPerformance() {
  const container = profileNode('enem-performance');
  try {
    const data = await window.api.get('/questions/practice/history?page=1');
    if (!data) return;
    if (!Number.isSafeInteger(data.total) || data.total < 0 || !Array.isArray(data.items)) throw new Error('Histórico indisponível.');
    profileText('stat-enem-total', String(data.total));
    if (!data.items.length) {
      profileText('stat-enem-recent', '—');
      container.textContent = 'Você ainda não registrou respostas no treino ENEM. Comece por uma disciplina de sua escolha.';
      return;
    }
    const correct = data.items.filter(item => item.isCorrect === true).length;
    profileText('stat-enem-recent', `${Math.round(correct / data.items.length * 100)}%`);
    container.textContent = `${correct} acertos em ${data.items.length} respostas mais recentes. O total de respostas inclui as rodadas de treino registradas, e não apenas questões distintas.`;
  } catch (_) {
    profileText('stat-enem-total', '—'); profileText('stat-enem-recent', '—');
    container.textContent = 'O desempenho do treino ENEM não foi atualizado. Tente novamente.';
  }
}

async function loadEssayHistory(token = historyLoadToken) {
  const container = profileNode('essays-history-container');
  try {
    const res = await window.api.get(`/essays/history${profileHistoryQuery()}`);
    if (token !== historyLoadToken) return;
    if (!res || !Array.isArray(res.items)) throw new Error('Histórico indisponível.');
    currentEssayHistory = res.items;
    profileText('stat-essays', String(res.items.length));
    const scores = res.items.map(p => p.score).filter(s => s !== null && s !== undefined && Number.isFinite(Number(s))).map(Number);
    profileText('stat-best-essay', scores.length ? profileScore(Math.max(...scores)) : '—');
    if (!res.items.length) { container.textContent = 'Nenhuma redação corrigida foi encontrada no período selecionado.'; return; }
    container.innerHTML = res.items.map(p => `<div class="history-card"><div><span>Ciclo ${profileEscape(p.cycleCode)}</span><h4>${p.themeNumber ? `Tema ${profileEscape(p.themeNumber)}: ` : ''}${profileEscape(p.title)}</h4><span>${p.correctedAt ? profileEscape(profileDateLabel(Date.parse(p.correctedAt))) : 'Correção salva'}</span></div><div class="history-actions"><strong>${profileScore(p.score)} / 10,0</strong><button type="button" class="btn btn-secondary" data-essay-id="${profileEscape(p.id)}">Ver Espelho</button></div></div>`).join('');
    container.querySelectorAll('[data-essay-id]').forEach(button => button.addEventListener('click', () => window.viewEssayDetails(button.dataset.essayId)));
  } catch (error) {
    if (token === historyLoadToken) container.textContent = `Não foi possível consultar as redações salvas: ${error.message || 'tente novamente.'}`;
  }
}

async function loadSimulationHistory(token = historyLoadToken) {
  const container = profileNode('simulations-history-container');
  try {
    const res = await window.api.get(`/simulations/attempts/history${profileHistoryQuery()}`);
    if (token !== historyLoadToken) return;
    if (!res || !Array.isArray(res.items)) throw new Error('Histórico indisponível.');
    const completed = res.items.filter(item => item.submitted === true);
    profileText('stat-simulations', String(completed.length));
    const rates = completed.filter(item => item.score !== null && Number.isFinite(Number(item.score)) && Number(item.totalQuestions) > 0).map(item => Number(item.score) / Number(item.totalQuestions));
    profileText('stat-best-sim', rates.length ? `${Math.round(Math.max(...rates) * 100)}%` : '—');
    if (!res.items.length) { container.textContent = 'Nenhum simulado foi encontrado no período selecionado.'; return; }
    container.innerHTML = res.items.map(item => `<div class="history-card"><div><h4>${profileEscape(item.title || 'Simulado PAES UEMA')}</h4><span>Ciclo ${profileEscape(item.cycleCode)} · ${item.submitted ? 'Concluído' : 'Não concluído'}</span>${item.finishedAt ? `<p>${profileEscape(profileDateLabel(Date.parse(item.finishedAt)))}</p>` : ''}</div><div class="history-actions"><strong>${item.submitted ? `${profileScore(item.score)} / ${profileEscape(item.totalQuestions)} acertos` : 'Sem resultado final'}</strong>${item.submitted && item.attemptId ? `<button type="button" class="btn btn-secondary" data-attempt-id="${profileEscape(item.attemptId)}">Ver desempenho por área</button>` : ''}</div></div>`).join('');
    container.querySelectorAll('[data-attempt-id]').forEach(button => button.addEventListener('click', () => viewHistoricalSimulation(button.dataset.attemptId)));
  } catch (error) {
    if (token === historyLoadToken) container.textContent = `Não foi possível consultar os simulados salvos: ${error.message || 'tente novamente.'}`;
  }
}

async function viewHistoricalSimulation(attemptId) {
  const token = ++historyReviewToken;
  const dialog = profileNode('simulation-history-modal');
  profileText('simulation-history-body', 'Consultando o resultado salvo...');
  dialog.showModal();
  try {
    const res = await window.api.get(`/simulations/attempts/${encodeURIComponent(attemptId)}/review`);
    if (token !== historyReviewToken || !dialog.open) return;
    if (!res || !res.areas || !Number.isFinite(Number(res.score))) throw new Error('Resultado indisponível.');
    const body = profileNode('simulation-history-body'); body.replaceChildren();
    const score = document.createElement('p'); score.textContent = `${res.score} acertos em ${res.totalQuestions} questões.`; body.append(score);
    for (const [area, values] of Object.entries(res.areas)) {
      const line = document.createElement('p'); line.textContent = `${area}: ${values.correct} / ${values.total} acertos.`; body.append(line);
    }
  } catch (error) {
    if (token === historyReviewToken && dialog.open) profileText('simulation-history-body', error.message || 'Não foi possível carregar o resultado salvo.');
  }
}

window.viewEssayDetails=async (promptId)=>{
  const prompt=currentEssayHistory.find(p=>p.id===promptId); if(!prompt)return;
  const token=++correctionLoad; const dialog=profileNode('essay-modal');
  profileText('modal-theme-title',`${prompt.themeNumber ? `Tema ${prompt.themeNumber}: ` : ''}${prompt.title}`);
  profileText('modal-date', `Ciclo ${prompt.cycleCode || 'não informado'}${prompt.correctedAt ? ` · ${profileDateLabel(Date.parse(prompt.correctedAt))}` : ''}`);
  profileText('modal-score',`${profileScore(prompt.score)} / 10,0`);
  profileText('modal-body-feedback','Consultando correção salva...');
  dialog.showModal();
  try {
    if(!prompt.essayId)throw new Error('Correção não identificada. Acesse a página Redação para consultar.');
    const correction=await window.api.get(`/essays/${encodeURIComponent(prompt.essayId)}`);
    if(token!==correctionLoad||!dialog.open||!correction)return;
    const feedback=correction.feedback || {};
    profileText('modal-score',`${profileScore(correction.totalScore)} / 10,0`);
    const criteria=[['theme','Atendimento ao tema'],['cohesion','Coesão'],['coherence','Coerência argumentativa'],['genre','Tipo dissertativo-argumentativo'],['grammarNorm','Norma padrão']];
    const content=criteria.map(([key,label])=>{
      const detail=feedback.criteria_details?.[key==='grammarNorm'?'grammar_norm':key] || {};
      const findings=Array.isArray(detail.findings)?detail.findings:[];
      return `<div class="card"><h4>${label} · ${profileScore(correction.criteria?.[key])} / 2,0</h4>
        <p class="feedback-text">${profileEscape(detail.diagnosis || 'Análise detalhada não disponível.')}</p>
        ${detail.student_quote?`<blockquote class="feedback-text">${profileEscape(detail.student_quote)}</blockquote>`:''}
        ${findings.map(f=>`<blockquote class="feedback-text">${profileEscape(f.student_quote)}</blockquote><p class="feedback-text">${profileEscape(f.explanation)}</p><p class="feedback-text">${profileEscape(f.effect)}</p><p class="feedback-text">${profileEscape(f.suggestion)}</p>`).join('')}
        ${detail.tip?`<p class="feedback-text"><strong>Próximo passo:</strong> ${profileEscape(detail.tip)}</p>`:''}</div>`;
    }).join('');
    profileNode('modal-body-feedback').innerHTML=`<p class="feedback-text">${profileEscape(feedback.pedagogical_feedback || 'Parecer geral não disponível nesta correção.')}</p>${content}<details><summary>Texto da redação</summary><p class="feedback-text">${profileEscape(correction.content)}</p></details><a href="redacao.html" class="btn btn-secondary">Abrir página de Redação</a>`;
  }catch(error){if(token===correctionLoad&&dialog.open)profileText('modal-body-feedback',error.message || 'Não foi possível carregar a correção.');}
};
window.closeModal=()=>{correctionLoad++;profileNode('essay-modal').close();};

function setupDeleteAccountListener() {
  const dialog=profileNode('delete-dialog'); const form=profileNode('delete-form');
  const button=profileNode('delete-submit'); let busy=false;
  const notice=(text)=>{profileText('delete-notice',text);profileNode('delete-notice').hidden=!text;};
  profileNode('btn-delete-account').addEventListener('click',()=>{form.reset();notice('');dialog.showModal();});
  profileNode('delete-cancel').addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(busy)return;
    if(profileNode('delete-confirmation').value!=='EXCLUIR'){notice('Digite exatamente EXCLUIR para confirmar.');return;}
    const password=profileNode('delete-password').value;
    if(!password){notice('Informe sua senha atual.');return;}
    busy=true;button.disabled=true;profileNode('delete-cancel').disabled=true;
    try {
      const result=await window.api.request('/users/me',{method:'DELETE',body:JSON.stringify({password})});
      if(!result)return;
      // Encerra apenas esta sessão, preservando outros dados do navegador.
      localStorage.removeItem('token');localStorage.removeItem('user');localStorage.removeItem('foreignLanguage');
      window.location.replace('login.html');
    }catch(error){notice(error.message || 'Não foi possível excluir a conta.');}
    finally {busy=false;button.disabled=false;profileNode('delete-cancel').disabled=false;profileNode('delete-password').value='';}
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  if(!window.api?.getToken()){window.location.replace('login.html');return;}
  setupLanguagePreference();setupDeleteAccountListener();
  profileNode('profile-history-cycle').addEventListener('change', event => {
    profileHistoryCycle = event.target.value;
    profileText('profile-history-status', profileHistoryCycle ? `Exibindo o ciclo ${profileHistoryCycle}.` : 'Exibindo os registros disponíveis de todos os ciclos.');
    refreshProfileHistory();
  });
  profileNode('simulation-history-close').addEventListener('click', () => profileNode('simulation-history-modal').close());
  profileNode('simulation-history-modal').addEventListener('close', () => historyReviewToken++);
  profileNode('essay-modal').addEventListener('close',()=>correctionLoad++);
  profileNode('refresh-performance').addEventListener('click', loadUserData);
  loadUserData();
  // Atualiza os avisos ao voltar à aba e ao cruzar a faixa de cinco dias.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentProfile) loadProfileAccess();
  });
  setInterval(() => {
    if (!document.hidden && currentProfile) renderProfileAccess(currentProfile, currentAccess);
  }, 60000);
});
