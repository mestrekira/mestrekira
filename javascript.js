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
incluirHTML("header", "header.html", configurarLinks);
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

function inicializarPaginacao() {
  const posts = Array.from(document.querySelectorAll(".publicacoes .post"));
  if (posts.length === 0) return;

  const porPagina = 20;
  const totalPaginas = Math.max(1, Math.ceil(posts.length / porPagina));
  let paginaAtual = 1;

  function mostrarPagina(pagina) {
    // Normaliza limites
    paginaAtual = Math.min(Math.max(pagina, 1), totalPaginas);

    // Esconde tudo
    posts.forEach((p) => (p.style.display = "none"));

    // Mostra intervalo da página atual
    const inicio = (paginaAtual - 1) * porPagina;
    const fim = inicio + porPagina;

    for (let i = inicio; i < fim && i < posts.length; i++) {
      // Seus cards são flex no CSS
      posts[i].style.display = "flex";
    }

    atualizarPaginacao();
  }

  function atualizarPaginacao() {
    const paginacaoDiv = document.getElementById("paginacao");
    if (!paginacaoDiv) return;

    // Se só existe 1 página, não mostra controles
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

  // Se não estiver na página do player, sai sem erro
  if (
    !audio ||
    !speedSelect ||
    !currentSpeedLabel ||
    !increaseBtn ||
    !decreaseBtn ||
    !audioDuration ||
    !downloadLink
  ) {
    return;
  }

  audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
      const sec = Math.round(audio.duration);
      const mm = Math.floor(sec / 60)
        .toString()
        .padStart(2, "0");
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

  const speedOptions = Array.from(speedSelect.options).map((o) =>
    parseFloat(o.value)
  );

  function stepSpeed(direction) {
    const current = parseFloat(speedSelect.value) || 1;
    let idx = speedOptions.indexOf(current);

    if (idx === -1) {
      idx = speedOptions.reduce(
        (acc, v, i) =>
          Math.abs(v - current) < Math.abs(speedOptions[acc] - current)
            ? i
            : acc,
        0
      );
    }

    const nextIdx = Math.min(
      Math.max(idx + direction, 0),
      speedOptions.length - 1
    );
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

function inicializarBotaoPlataformaRedacao() {
  const btn = document.getElementById("btnPlataformaRedacao");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
