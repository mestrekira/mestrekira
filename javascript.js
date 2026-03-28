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
  inicializarBuscaSite();
});
incluirHTML("aside", "aside.html");
incluirHTML("footer", "footer.html");

function configurarLinks() {
  const mapaPaginas = {
    fonetica: "conteudos-fonetica.html",
    fonologia: "conteudos-fonologia.html",
    morfologia: "conteudos-morfologia.html",
    sintaxe: "conteudos-sintaxe.html",
    semantica: "conteudos-semantica.html",
    pragmatica: "conteudos-pragmatica.html",
    "literatura-portuguesa": "conteudos-literatura-portuguesa.html",
    "literatura-brasileira": "conteudos-literatura-brasileira.html",
    "literatura-africana-portuguesa": "conteudos-literatura-africana-portuguesa.html",
    critica: "conteudos-critica.html",
    midiatico: "conteudos-midiatico.html",
    gramatica: "conteudos-gramatica.html",
    producaotextual: "conteudos-producao-textual.html",
    interpretacaotextual: "conteudos-interpretacao-textual.html",
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      const destino = (this.getAttribute("href") || "")
        .replace("#", "")
        .toLowerCase();

      const pagina = mapaPaginas[destino];
      if (!pagina) return;

      e.preventDefault();
      window.location.href = pagina;
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
   Paginação
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
      posts[i].style.display = "flex";
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
      anterior.textContent = "← Página anterior";
      anterior.onclick = () => {
        mostrarPagina(paginaAtual - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      paginacaoDiv.appendChild(anterior);
    }

    const info = document.createElement("span");
    info.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    paginacaoDiv.appendChild(info);

    if (paginaAtual < totalPaginas) {
      const proxima = document.createElement("button");
      proxima.textContent = "Próxima página →";
      proxima.onclick = () => {
        mostrarPagina(paginaAtual + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      paginacaoDiv.appendChild(proxima);
    }
  }

  mostrarPagina(paginaAtual);
}

/* =========================
   Player de áudio
========================= */
function inicializarPlayerAudio() {
  const audio = document.getElementById("playerAudio");
  const speedSelect = document.getElementById("speedSelect");
  const currentSpeedLabel = document.getElementById("currentSpeedLabel");
  const increaseBtn = document.getElementById("increaseSpeed");
  const decreaseBtn = document.getElementById("decreaseSpeed");
  const audioDuration = document.getElementById("audioDuration");
  const downloadLink = document.getElementById("downloadLink");

  if (!audio || !speedSelect) return;

  audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
      const sec = Math.round(audio.duration);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
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
    setPlaybackRate(parseFloat(e.target.value) || 1);
  });

  increaseBtn.onclick = () =>
    setPlaybackRate(Math.min(audio.playbackRate + 0.25, 2));

  decreaseBtn.onclick = () =>
    setPlaybackRate(Math.max(audio.playbackRate - 0.25, 0.5));

  downloadLink.href = audio.src;
}

/* =========================
   FAQ
========================= */
function inicializarFAQ() {
  document.querySelectorAll(".faq-pergunta").forEach((pergunta) => {
    pergunta.onclick = () => {
      const resposta = pergunta.nextElementSibling;
      if (resposta) resposta.classList.toggle("ativo");
    };
  });
}

/* =========================
   BOTÃO PLATAFORMA (CORRIGIDO)
========================= */
function inicializarBotaoPlataformaRedacao() {
  const btn = document.getElementById("btnPlataformaRedacao");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = "/app/frontend/index.html";
  });
}

/* =========================
   BUSCA
========================= */
function inicializarBuscaSite() {
  const input = document.getElementById("buscaSite");
  const sugestoes = document.getElementById("buscaSugestoes");
  if (!input || !sugestoes) return;

  carregarSearchIndex(() => configurarBusca(input, sugestoes));
}

function carregarSearchIndex(cb) {
  const s = document.createElement("script");
  s.src = "search-index.js";
  s.defer = true;
  s.onload = cb;
  document.head.appendChild(s);
}

function configurarBusca(input, sugestoes) {
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();

    const resultados = (window.SEARCH_INDEX || []).filter((item) =>
      item.title.toLowerCase().includes(q)
    );

    sugestoes.innerHTML = resultados
      .map(
        (r) =>
          `<div class="busca-item" onclick="location.href='${r.url}'">${r.title}</div>`
      )
      .join("");
  });
}

/* =========================
   MENU
========================= */
function mkToggleMenu() {
  document.getElementById("mkMenu").classList.toggle("active");
  document.querySelector(".menu-overlay").classList.toggle("active");
}

function mkCloseMenu() {
  document.getElementById("mkMenu").classList.remove("active");
  document.querySelector(".menu-overlay").classList.remove("active");
}
