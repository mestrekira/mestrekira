import { storage } from './storage.js';

const descriptions = {
  'painel-aluno.html': 'Encontre sua turma e continue o percurso de escrita.',
  'professor-salas.html': 'Organize suas turmas, proponha atividades e acompanhe as redações.',
  'painel-escola.html': 'Gerencie os anos letivos, as salas e os professores da instituição.',
  'sala-aluno.html': 'Consulte as atividades e acompanhe as devolutivas da sua turma.',
  'sala-professor.html': 'Organize as tarefas e acompanhe as produções dos estudantes.',
  'redacao.html': 'Consulte o tema, escreva ou cole seu texto e salve o rascunho antes de enviar.',
  'correcao.html': 'Leia a redação, confira as sugestões e construa a devolutiva final.',
  'feedback-aluno.html': 'Leia as orientações, ouça o áudio e identifique os próximos passos da sua escrita.',
  'feedback-professor.html': 'Confira a devolutiva registrada e gerencie a orientação em áudio.',
  'feedback.html': 'Consulte os comentários e as orientações do professor.',
  'desempenho.html': 'Acompanhe as redações corrigidas e consulte seu relatório.',
  'desempenho-professor.html': 'Observe o percurso da turma e consulte os relatórios de desempenho.',
  'desempenho-escola.html': 'Consulte os indicadores e relatórios das salas da instituição.',
  'entrar-sala.html': 'Use o código informado pelo professor para entrar na sua turma.',
};
document.documentElement.classList.add('mk-internal-root');
document.body.classList.add('mk-internal');
const main = document.querySelector('main');
if (main && !document.querySelector('.internal-header')) {
  if (!main.id) main.id = 'conteudo';
  let user; try { user = JSON.parse(storage.getItem('user') || 'null'); } catch {}
  const role = String(user?.role || '').toLowerCase();
  const home = role === 'school' ? 'painel-escola.html' : role === 'professor' || role === 'teacher' ? 'professor-salas.html' : 'painel-aluno.html';
  const header = document.createElement('header'); header.className = 'internal-header';
  const inner = document.createElement('div'); inner.className = 'internal-header-inner';
  const brand = document.createElement('a'); brand.className = 'internal-brand'; brand.href = home;
  const logo = document.createElement('img'); logo.src = 'logo1.png'; logo.alt = ''; logo.width = 48; logo.height = 38;
  const name = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small');
  title.textContent = 'Mestre Kira'; subtitle.textContent = 'Plataforma de redação'; name.append(title, subtitle); brand.append(logo, name);
  const nav = document.createElement('nav'); nav.className = 'internal-nav'; nav.setAttribute('aria-label', 'Navegação principal');
  const homeLink = document.createElement('a'); homeLink.href = home; homeLink.textContent = role === 'school' ? 'Painel' : 'Minhas salas';
  const help = document.createElement('a'); help.href = 'suporte.html'; help.textContent = 'Ajuda'; nav.append(homeLink, help); inner.append(brand, nav); header.append(inner);
  const skip = document.createElement('a'); skip.className = 'internal-skip'; skip.href = `#${main.id}`; skip.textContent = 'Pular para o conteúdo';
  document.body.insertBefore(header, main); document.body.insertBefore(skip, header);
  const heading = main.querySelector(':scope > h1, :scope > h2, :scope > header h2') || main.querySelector('h1,h2');
  if (heading) {
    heading.classList.add('page-title');
    const description = descriptions[location.pathname.split('/').pop()];
    if (description) { const text = document.createElement('p'); text.className = 'page-description'; text.textContent = description; heading.insertAdjacentElement('afterend', text); }
  }
}
