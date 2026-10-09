(() => {
  'use strict';
  // Somente comunicação: a decisão de acesso é sempre do backend.
  if (document.getElementById('paes-billing-notice')) return;
  const container = document.querySelector('main');
  if (!container) return;
  const notice = document.createElement('aside');
  notice.id = 'paes-billing-notice';
  notice.setAttribute('aria-label', 'Informações sobre acesso à plataforma');
  notice.style.cssText = 'padding:14px 18px;margin:16px 0;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#172554;line-height:1.6';
  const text = document.createElement('p');
  text.style.margin = '0';
  text.textContent = Date.now() < Date.parse('2026-10-22T03:00:00.000Z')
    ? 'Acesso geral gratuito até 21/10/2026. A partir de 22/10, o acesso integral custará R$ 24,99 por 30 dias. Convites escolares válidos serão preservados.'
    : 'O banco ENEM permanece com uma seleção gratuita de 50%. Acesso integral por R$ 24,99 durante 30 dias, com preservação dos convites escolares válidos.';
  const link = document.createElement('a');
  link.href = 'assinatura.html'; link.textContent = 'Consultar assinatura';
  notice.append(text, link); container.prepend(notice);
})();
