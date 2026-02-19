function incluirHTML(id, url, callback) {
  fetch(url)
    .then((res) => res.text())
    .then((data) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = data;
      if (typeof callback === "function") callback();
    })
    .catch((erro) => console.error("Erro ao carregar " + url, erro));
}

// Inclui partes fixas
incluirHTML("header", "header.html", () => {
  configurarLinks();
  inicializarBuscaSite(); // novo
});
incluirHTML("aside", "aside.html");
incluirHTML("footer", "footer.html");

function configurarLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      const destino = (this.getAttribute("href") || "")
        .replace("#", "")
        .toLowerCase();

      const destinosValidos = [
        "fonetica",
        "fonologia",
        "morfologia",
        "sintaxe",
        "semantica",
        "pragmatica",
        "literatura-portuguesa",
        "literatura-brasileira",
        "literatura-africana-portuguesa",
        "critica",
        "midiatico",
        "gramatica",
        "producaotextual",
        "interpretacaotextual",
      ];

      if (destinosValidos.includes(destino)) {
        e.preventDefault();
        window.location.href = `conteudos${destino}.html`;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarPaginacao();
  inicializarPlayerAudio();
  inicializarFAQ();
  inicializarBotaoPlataformaRedacao();
});

/* =========================
   Paginação (cards)
========================= */
function inicializarPaginacao() {
  const posts = Array.from(document.querySelectorAll(".publicacoes .post"));
  if (posts.length === 0) return;

  const porPagina = 20;
  const totalPaginas = Math.max(1, Math.ceil(posts.length / porPagina));
  let paginaAtual = 1;

  function mostrarPagina(pagina) {
    paginaAtual = Math.min(Math.max(pagina, 1), totalPaginas);

    posts.forEach((p) => (p.style.display = "none"));

    const inicio = (paginaAtual - 1) * porPagina;
    const fim = inicio + porPagina;

    for (let i = inicio; i < fim && i < posts.length; i++) {
      posts[i].style.display = "flex"; // compatível com seu CSS
    }

    atualizarPaginacao();
  }

  function atualizarPaginacao() {
    const paginacaoDiv = document.getElementById("paginacao");
    if (!paginacaoDiv) return;

    if (totalPaginas <= 1) {
      paginacaoDiv.innerHTML = "";
      return;
    }

    paginacaoDiv.innerHTML = "";

    if (paginaAtual > 1) {
      const anterior = document.createElement("button");
      anterior.type = "button";
      anterior.textContent = "← Página anterior";
      anterior.addEventListener("click", () => {
        mostrarPagina(paginaAtual - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      paginacaoDiv.appendChild(anterior);
    }

    const info = document.createElement("span");
    info.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    paginacaoDiv.appendChild(info);

    if (paginaAtual < totalPaginas) {
      const proxima = document.createElement("button");
      proxima.type = "button";
      proxima.textContent = "Próxima página →";
      proxima.addEventListener("click", () => {
        mostrarPagina(paginaAtual + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      paginacaoDiv.appendChild(proxima);
    }
  }

  mostrarPagina(paginaAtual);
}

function inicializarPlayerAudio() {
  const audio = document.getElementById("playerAudio");
  const speedSelect = document.getElementById("speedSelect");
  const currentSpeedLabel = document.getElementById("currentSpeedLabel");
  const increaseBtn = document.getElementById("increaseSpeed");
  const decreaseBtn = document.getElementById("decreaseSpeed");
  const audioDuration = document.getElementById("audioDuration");
  const downloadLink = document.getElementById("downloadLink");

  if (
    !audio ||
    !speedSelect ||
    !currentSpeedLabel ||
    !increaseBtn ||
    !decreaseBtn ||
    !audioDuration ||
    !downloadLink
  ) return;

  audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
      const sec = Math.round(audio.duration);
      const mm = Math.floor(sec / 60).toString().padStart(2, "0");
      const ss = (sec % 60).toString().padStart(2, "0");
      audioDuration.textContent = `Duração: ${mm}:${ss}`;
    }
  });

  function setPlaybackRate(rate) {
    audio.playbackRate = rate;
    currentSpeedLabel.textContent = rate + "×";
    speedSelect.value = String(rate);
  }

  setPlaybackRate(1);

  speedSelect.addEventListener("change", (e) => {
    const val = parseFloat(e.target.value) || 1;
    setPlaybackRate(val);
  });

  const speedOptions = Array.from(speedSelect.options).map((o) => parseFloat(o.value));

  function stepSpeed(direction) {
    const current = parseFloat(speedSelect.value) || 1;
    let idx = speedOptions.indexOf(current);

    if (idx === -1) {
      idx = speedOptions.reduce(
        (acc, v, i) =>
          Math.abs(v - current) < Math.abs(speedOptions[acc] - current) ? i : acc,
        0
      );
    }

    const nextIdx = Math.min(Math.max(idx + direction, 0), speedOptions.length - 1);
    setPlaybackRate(speedOptions[nextIdx]);
  }

  increaseBtn.addEventListener("click", () => stepSpeed(+1));
  decreaseBtn.addEventListener("click", () => stepSpeed(-1));

  downloadLink.href = audio.src;

  document.addEventListener("keydown", (ev) => {
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (ev.key === "[") {
      stepSpeed(-1);
      ev.preventDefault();
    }
    if (ev.key === "]") {
      stepSpeed(+1);
      ev.preventDefault();
    }
  });
}

function inicializarFAQ() {
  const perguntas = document.querySelectorAll(".faq-pergunta");
  if (!perguntas.length) return;

  perguntas.forEach((pergunta) => {
    pergunta.addEventListener("click", () => {
      const resposta = pergunta.nextElementSibling;
      if (!resposta) return;
      resposta.classList.toggle("ativo");
    });
  });
}

/* =========================
   Botão plataforma (guard)
========================= */
function inicializarBotaoPlataformaRedacao() {
  const btn = document.getElementById("btnPlataformaRedacao");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = "/app/index.html";
  });
}

/* =========================
   Busca no site (novo)
========================= */
function inicializarBuscaSite() {
  const input = document.getElementById("buscaSite");
  const sugestoes = document.getElementById("buscaSugestoes");

  // Se a página não tiver busca (ou header ainda não carregou), sai
  if (!input || !sugestoes) return;

  // Carrega o índice, se ainda não estiver carregado
  carregarSearchIndex(() => configurarBusca(input, sugestoes));
}

function carregarSearchIndex(cb) {
  if (Array.isArray(window.SEARCH_INDEX) && window.SEARCH_INDEX.length) {
    cb();
    return;
  }

  // Evita injetar duas vezes
  if (document.querySelector('script[data-search-index="1"]')) {
    // espera um pouco e tenta de novo
    const t = setInterval(() => {
      if (Array.isArray(window.SEARCH_INDEX) && window.SEARCH_INDEX.length) {
        clearInterval(t);
        cb();
      }
    }, 50);
    setTimeout(() => clearInterval(t), 3000);
    return;
  }

  const s = document.createElement("script");
  s.src = "search-index.js";
  s.defer = true;
  s.dataset.searchIndex = "1";
  s.onload = () => cb();
  s.onerror = () => {
    console.error("Não foi possível carregar search-index.js");
    cb(); // ainda assim não quebra o site
  };
  document.head.appendChild(s);
}

function configurarBusca(input, sugestoes) {
  let resultadosAtuais = [];
  let ativo = -1;

  function normalizar(str) {
    return (str || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function abrirSugestoes() {
    sugestoes.style.display = "block";
  }

  function fecharSugestoes() {
    sugestoes.style.display = "none";
    sugestoes.innerHTML = "";
    resultadosAtuais = [];
    ativo = -1;
  }

  function navegarPara(url) {
    if (!url) return;
    window.location.href = url;
  }

  function render(lista, query) {
    sugestoes.innerHTML = "";
    ativo = -1;

    if (!lista.length) {
      sugestoes.innerHTML = `<div class="busca-vazio">Nenhum resultado para “${escapeHtml(query)}”.</div>`;
      abrirSugestoes();
      return;
    }

    lista.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "busca-item";
      div.setAttribute("role", "option");

      div.innerHTML = `
        <div class="busca-titulo">${escapeHtml(item.title || item.url)}</div>
        <div class="busca-sub">${escapeHtml(item.url)}</div>
      `;

      div.addEventListener("mousedown", (e) => {
        // mousedown para não perder o foco antes do clique (blur)
        e.preventDefault();
        navegarPara(item.url);
      });

      sugestoes.appendChild(div);
    });

    abrirSugestoes();
  }

  function marcarAtivo(novo) {
    const itens = Array.from(sugestoes.querySelectorAll(".busca-item"));
    itens.forEach((el) => el.classList.remove("ativo"));

    ativo = novo;
    if (ativo >= 0 && ativo < itens.length) {
      itens[ativo].classList.add("ativo");
      itens[ativo].scrollIntoView({ block: "nearest" });
    }
  }

  function buscar(queryRaw) {
    const q = normalizar(queryRaw);
    if (!q) {
      fecharSugestoes();
      return;
    }

    const idx = Array.isArray(window.SEARCH_INDEX) ? window.SEARCH_INDEX : [];
    const tokens = q.split(/\s+/).filter(Boolean);

    function score(item) {
      const title = normalizar(item.title);
      const url = normalizar(item.url);
      const keys = Array.isArray(item.keywords) ? item.keywords.map(normalizar) : [];
      const blob = [title, url, ...keys].join(" ");

      let s = 0;

      // Prioriza match no título
      if (title.includes(q)) s += 50;

      // URL também conta
      if (url.includes(q)) s += 25;

      // Tokens: cada token encontrado soma
      tokens.forEach((t) => {
        if (title.includes(t)) s += 12;
        else if (keys.some((k) => k.includes(t))) s += 8;
        else if (blob.includes(t)) s += 4;
      });

      return s;
    }

    const encontrados = idx
      .map((item) => ({ item, s: score(item) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.item);

    resultadosAtuais = encontrados;
    render(encontrados, queryRaw);
  }

  
  input.addEventListener("input", () => buscar(input.value));

  input.addEventListener("focus", () => {
    if (input.value.trim()) buscar(input.value);
  });

  input.addEventListener("keydown", (e) => {
    const itens = Array.from(sugestoes.querySelectorAll(".busca-item"));

    if (e.key === "Escape") {
      fecharSugestoes();
      input.blur();
      return;
    }

    if (sugestoes.style.display !== "block") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      marcarAtivo(Math.min(ativo + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      marcarAtivo(Math.max(ativo - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (ativo >= 0 && resultadosAtuais[ativo]) {
        navegarPara(resultadosAtuais[ativo].url);
      } else if (resultadosAtuais[0]) {
        navegarPara(resultadosAtuais[0].url);
      }
    }
  });

  document.addEventListener("click", (e) => {
    const dentro = e.target === input || sugestoes.contains(e.target);
    if (!dentro) fecharSugestoes();
  });
}

function escapeHtml(str) {
  return (str || "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

  function mkToggleMenu() {
    const menu = document.getElementById('mkMenu');
    const overlay = document.querySelector('.menu-overlay');
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
  }

  function mkCloseMenu() {
    const menu = document.getElementById('mkMenu');
    const overlay = document.querySelector('.menu-overlay');
    menu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Acordeão: abre/fecha subseções no mobile
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.menu-fixo li > a');
    if (!link) return;

    const li = link.parentElement;
    const submenu = li.querySelector(':scope > ul');

    // Se tem submenu, no mobile vira acordeão (não navega ao clicar no pai)
    if (submenu && window.matchMedia('(max-width: 900px)').matches) {
      e.preventDefault();

      li.classList.toggle('open');

      // Fecha os outros abertos (opcional; deixa mais organizado)
      const siblings = li.parentElement.querySelectorAll(':scope > li.has-submenu.open');
      siblings.forEach(sib => { if (sib !== li) sib.classList.remove('open'); });
    }
  });

  // Marca automaticamente quem tem submenu (pra seta aparecer)
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.menu-fixo li').forEach(li => {
      const submenu = li.querySelector(':scope > ul');
      if (submenu) li.classList.add('has-submenu');
    });
  });

  // Fecha menu com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') mkCloseMenu();
  });
