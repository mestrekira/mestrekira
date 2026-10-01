(() => {
  'use strict';
  // Aviso público da fase gratuita; não concede permissões nem consulta assinaturas.
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('account-access');
    if (!panel) return;
    panel.replaceChildren();
    panel.dataset.accessState = 'trial';
    const copy = document.createElement('div');
    copy.className = 'account-access-copy';
    const title = document.createElement('h2');
    title.textContent = 'Gabarita PAES — fase gratuita';
    const text = document.createElement('p');
    text.textContent = 'Continue praticando com acesso completo. O encerramento da gratuidade será comunicado com antecedência. Não haverá cobrança automática.';
    copy.append(title, text);
    panel.append(copy);
    if (!window.api?.getToken()) {
      const actions = document.createElement('div');
      actions.className = 'account-access-actions';
      const link = document.createElement('a');
      link.className = 'btn btn-secondary';
      link.href = 'login.html';
      link.textContent = 'Entrar na minha conta';
      actions.append(link); panel.append(actions);
    }
    panel.hidden = false;
  });
})();
