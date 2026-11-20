(() => {
  'use strict';
  async function load() {
    const host = document.getElementById('simulation-extras-card');
    if (!host || !window.api?.getToken()) return;
    try {
      const res = await window.api.get('/simulation-extras');
      if (!res?.items?.length) { host.hidden = true; return; }
      host.replaceChildren();
      const heading = document.createElement('h2'); heading.textContent = 'Continue sua preparação: simulado extra';
      const text = document.createElement('p'); text.textContent = 'Atividade opcional, com progresso próprio e sem alterar o ranking. Conclua o simulado oficial e envie uma redação do ciclo para liberar.';
      const link = document.createElement('a'); link.href = 'simulado-extra.html'; link.className = 'btn'; link.textContent = res.items.some(e => e.unlocked) ? 'Acessar simulado extra' : 'Consultar requisitos do extra';
      host.append(heading, text, link); host.hidden = false;
    } catch { host.hidden = true; /* Falha do extra não interfere no simulado oficial. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true }); else load();
  window.addEventListener('focus', load);
})();
