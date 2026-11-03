(function () {
  // evita duplicar caso alguém importe duas vezes
  if (document.documentElement.dataset.mkFooter === '1') return;
  document.documentElement.dataset.mkFooter = '1';

  const year = new Date().getFullYear();

  // cria footer
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<p>&copy; ${year} Mestre Kira. Todos os direitos reservados.</p>`;

  // garante que exista um "main" wrapper (sem precisar editar todas as páginas)
  // se já existir <main>, ok. Se não existir, cria e move os filhos do body (exceto scripts/footer) pra dentro.
  let main = document.querySelector('main');

  if (!main) {
    main = document.createElement('main');

    // move tudo que é conteúdo do body para dentro do main
    // mantendo scripts no final
    const nodes = Array.from(document.body.childNodes);

    nodes.forEach((node) => {
      // não mover o próprio footer (ainda não existe), nem scripts que carregam módulos no final
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName;
        if (tag === 'SCRIPT') return; // deixa scripts onde estão
      }
      main.appendChild(node);
    });

    // insere main no topo do body
    document.body.insertBefore(main, document.body.firstChild);
  }

  // insere footer no final do body
  document.body.appendChild(footer);
})();
