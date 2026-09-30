let currentEssayHistory = [];
let currentProfile = null;
let correctionLoad = 0;
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
  const labels = { PREMIUM:'Assinatura ativa', TRIAL:'Teste gratuito ativo', PRELAUNCH:'Acesso de testes', EXPIRED:'Acesso gratuito' };
  profileText('plan-badge', labels[user.paesAccess?.accessReason] || 'Acesso não confirmado');
  profileNode('plan-cta').hidden = user.paesAccess?.accessReason === 'PREMIUM';
  const language = user.foreignLanguage;
  if (!['INGLES','ESPANHOL'].includes(language)) throw new Error('Não foi possível confirmar seu idioma cadastrado.');
  profileText('lang-badge', `Opção: ${language === 'ESPANHOL' ? 'Língua Espanhola' : 'Língua Inglesa'}`);
  profileNode('select-language').value = language;
  profileNode('select-language').disabled = false;
  profileNode('btn-save-lang').disabled = false;
  currentProfile = user;
}

async function loadUserData() {
  try {
    const user = await window.api.get('/users/me');
    if (!user) return;
    applyProfile(user);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.paesAccess?.canAccess === false) {
      for (const id of ['essays-history-container','simulations-history-container']) profileText(id, 'A consulta deste módulo exige acesso completo. Confira a situação do seu acesso acima.');
      return;
    }
    if (user.paesAccess?.canAccess !== true) throw new Error('Não foi possível confirmar o acesso aos seus resultados.');
    await Promise.allSettled([loadEssayHistory(), loadSimulationHistory()]);
  } catch (error) {
    profileText('profile-name','Não foi possível carregar o perfil');
    profileText('profile-email','Atualize a página para tentar novamente.');
    profileNotice(error.message || 'Não foi possível consultar sua conta.',true);
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
      if (fresh.paesAccess?.canAccess === true) await Promise.allSettled([loadEssayHistory(),loadSimulationHistory()]);
    } catch (error) {
      if (currentProfile) select.value = currentProfile.foreignLanguage;
      profileNotice(error.message || 'Não foi possível salvar sua preferência.',true);
    } finally { button.disabled = false; select.disabled = false; }
  });
}

async function loadEssayHistory() {
  const container=profileNode('essays-history-container');
  try {
    const res = await window.api.get('/essays/cycle-status');
    if (!res) return;
    if (!Array.isArray(res.prompts)) {
      profileText('stat-essays','—'); profileText('stat-best-essay','—');
      container.textContent=res.message || 'Conclua o simulado do ciclo para consultar as propostas de redação.';
      currentEssayHistory=[]; return;
    }
    currentEssayHistory=res.prompts.filter(p=>p.isSubmitted);
    profileText('stat-essays',`${currentEssayHistory.length} / ${res.prompts.length}`);
    const scores=currentEssayHistory.map(p=>p.score).filter(s=>s!==null&&s!==undefined&&Number.isFinite(Number(s))).map(Number);
    profileText('stat-best-essay',scores.length ? profileScore(Math.max(...scores)) : '—');
    if (!currentEssayHistory.length) {container.textContent='Você ainda não enviou redações neste ciclo.';return;}
    container.innerHTML=currentEssayHistory.map(p=>`<div class="history-card"><div><span>Tema ${profileEscape(p.themeNumber)}</span><h4>${profileEscape(p.title)}</h4><span>Avaliado nos 5 critérios da UEMA</span></div><div class="history-actions"><strong>${profileScore(p.score)} / 10,0</strong><button class="btn btn-secondary" data-essay-id="${profileEscape(p.id)}">Ver Espelho</button></div></div>`).join('');
    container.querySelectorAll('[data-essay-id]').forEach(button=>button.addEventListener('click',()=>window.viewEssayDetails(button.dataset.essayId)));
  } catch (error) { container.textContent=`Não foi possível consultar as redações: ${error.message || 'tente novamente.'}`; }
}

async function loadSimulationHistory() {
  const container=profileNode('simulations-history-container');
  try {
    const res=await window.api.get('/simulations/my-status');
    if (!res) return;
    profileText('stat-simulations',res.submitted?'1':'0');
    if (!res.submitted) {profileText('stat-best-sim','—');container.textContent='Nenhum simulado finalizado neste ciclo.';return;}
    const score=Number(res.score); const total=Number(res.totalQuestions);
    if (!Number.isFinite(score)||!Number.isFinite(total)||total<=0) throw new Error('Pontuação indisponível.');
    profileText('stat-best-sim',`${Math.round(score/total*100)}%`);
    container.innerHTML=`<div class="history-card"><div><h4>Simulado Oficial PAES UEMA</h4><span>Ciclo: ${profileEscape(res.cycleCode)}</span></div><div class="history-actions"><strong>${score} / ${total} acertos</strong><a href="simulado.html" class="btn btn-secondary">Revisar Gabarito</a></div></div>`;
  } catch(error) {profileText('stat-simulations','—');profileText('stat-best-sim','—');container.textContent=`Não foi possível consultar o simulado: ${error.message || 'tente novamente.'}`;}
}

window.viewEssayDetails=async (promptId)=>{
  const prompt=currentEssayHistory.find(p=>p.id===promptId); if(!prompt)return;
  const token=++correctionLoad; const dialog=profileNode('essay-modal');
  profileText('modal-theme-title',`Tema ${prompt.themeNumber}: ${prompt.title}`);
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
  profileNode('essay-modal').addEventListener('close',()=>correctionLoad++);
  loadUserData();
});
