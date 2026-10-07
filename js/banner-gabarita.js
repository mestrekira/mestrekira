/* Gabarita Paes — banner compartilhado para as páginas públicas do Mestre Kira.
 * Edite a configuração abaixo para atualizar a divulgação em todas as páginas.
 * Depois de publicar uma atualização, altere a versão ?v=... do script quando
 * precisar evitar que visitantes reutilizem uma cópia antiga em cache.
 */
(() => {
  'use strict';

  const config = {
    enabled: true,
    brand: 'Gabarita Paes',
    badge: 'Gratuito por tempo limitado',
    title: 'Vai fazer o PAES UEMA?',
    description: 'Pratique com simulados inéditos e treine com questões do ENEM, receba feedback de redação por IA e organize sua revisão.',
    button: 'Criar minha conta',
    destination: 'https://mestrekira.com.br/gabarita-paes/cadastro.html',
    logo: 'https://mestrekira.com.br/logo1.png',
    // Evita divulgação sobre formulários e atividades das próprias plataformas.
    excludedPaths: ['/gabarita-paes', '/app'],
  };

  function render() {
    if (!config.enabled || document.getElementById('mk-gabarita-banner')) return;
    const path = window.location.pathname.toLowerCase();
    if (config.excludedPaths.some(prefix => path === prefix || path.startsWith(prefix + '/'))) return;

    const host = document.createElement('aside');
    host.id = 'mk-gabarita-banner';
    host.setAttribute('aria-label', 'Conheça o Gabarita Paes');
    // Isola o visual das regras de imagens, links e títulos do site existente.
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display:block; width:100%; max-width:1040px; margin:24px auto; box-sizing:border-box; }
      *, *::before, *::after { box-sizing:border-box; }
      .banner { display:flex; flex-wrap:wrap; align-items:center; gap:24px; padding:26px 28px;
        border:1px solid #dbe4f4; border-left:6px solid #1e3a8a; border-radius:16px;
        background:#f4f7ff; color:#172554; font:16px/1.55 Arial,Helvetica,sans-serif; }
      .content { flex:1 1 360px; min-width:0; }
      .brand { display:flex; align-items:center; gap:10px; margin:0 0 12px; }
      .logo { display:block; width:40px; height:40px; object-fit:contain; flex-shrink:0; }
      .brand-name { font-size:17px; font-weight:700; }
      .heading { margin:0 0 8px; color:#1e3a8a; font-size:clamp(22px,3vw,28px); line-height:1.2; font-weight:800; }
      .description { margin:0; color:#334155; overflow-wrap:anywhere; }
      .action { flex:0 1 230px; display:flex; flex-direction:column; align-items:center; gap:12px; }
      .badge { display:inline-block; padding:5px 12px; border-radius:20px; background:#facc15;
        color:#172554; font-size:13px; font-weight:700; text-align:center; }
      .button { display:flex; align-items:center; justify-content:center; width:100%; min-height:48px;
        padding:12px 20px; border:2px solid #1e3a8a; border-radius:9px; background:#1e3a8a;
        color:#fff; text-decoration:none; font-weight:700; text-align:center; }
      .button:hover { background:#172554; border-color:#172554; }
      .button:focus-visible { outline:3px solid #172554; outline-offset:4px; }
      @media (max-width:600px) {
        :host { margin:20px auto; }
        .banner { padding:20px 18px; gap:18px; border-radius:12px; }
        .content, .action { flex-basis:100%; }
        .action { align-items:stretch; }
        .badge { align-self:flex-start; }
      }
    `;
    const banner = document.createElement('div');
    banner.className = 'banner';
    const content = document.createElement('div');
    content.className = 'content';
    const brand = document.createElement('div');
    brand.className = 'brand';
    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.src = config.logo;
    logo.alt = '';
    logo.width = 40;
    logo.height = 40;
    logo.addEventListener('error', () => logo.remove(), { once: true });
    const brandName = document.createElement('span');
    brandName.className = 'brand-name';
    brandName.textContent = config.brand;
    brand.append(logo, brandName);
    const heading = document.createElement('h2');
    heading.className = 'heading';
    heading.textContent = config.title;
    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = config.description;
    content.append(brand, heading, description);
    const action = document.createElement('div');
    action.className = 'action';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = config.badge;
    const button = document.createElement('a');
    button.className = 'button';
    button.href = config.destination;
    button.textContent = config.button;
    action.append(badge, button);
    banner.append(content, action);
    root.append(style, banner);

    const slot = document.querySelector('[data-gabarita-banner]');
    if (slot) {
      slot.appendChild(host);
      return;
    }
    const main = document.querySelector('main') || document.querySelector('article');
    if (main) {
      const title = main.querySelector('h1');
      if (title) title.after(host);
      else main.prepend(host);
      return;
    }
    // Páginas sem main/article: mantém o banner no fluxo, depois do cabeçalho.
    const header = document.querySelector('body > header');
    if (header) header.after(host);
    else document.body.prepend(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
