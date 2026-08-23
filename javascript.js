function incluirHTML(id, url, callback) {
  fetch(url)
    .then((res) => res.text())
    .then((data) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.innerHTML = data;

      if (typeof callback === "function") {
        callback();
      }
    })
    .catch((erro) => {
      console.error("Erro ao carregar " + url, erro);
    });
}

incluirHTML("header", "header.html", () => {
  inicializarBuscaSite();
  inicializarMenuMobile();
});

incluirHTML("aside", "aside.html");
incluirHTML("footer", "footer.html");

document.addEventListener("DOMContentLoaded", () => {
  inicializarPaginacao();
  inicializarPlayerAudio();
  inicializarFAQ();
  inicializarBotaoPlataformaRedacao();
});

function inicializarPaginacao() {
  const posts = Array.from(
    document.querySelectorAll(".publicacoes .post")
  );

  if (posts.length === 0) return;
  
  posts.forEach((post) => {
    post.style.display = "flex";
  });
}

function inicializarPlayerAudio() {
  const audio =
    document.getElementById("playerAudio");

  const speedSelect =
    document.getElementById("speedSelect");

  const currentSpeedLabel =
    document.getElementById("currentSpeedLabel");

  const increaseBtn =
    document.getElementById("increaseSpeed");

  const decreaseBtn =
    document.getElementById("decreaseSpeed");

  const audioDuration =
    document.getElementById("audioDuration");

  const downloadLink =
    document.getElementById("downloadLink");

  if (!audio || !speedSelect) return;

  audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration) && audioDuration) {
      const segundos = Math.round(audio.duration);

      const minutos = String(
        Math.floor(segundos / 60)
      ).padStart(2, "0");

      const segundosRestantes = String(
        segundos % 60
      ).padStart(2, "0");

      audioDuration.textContent =
        `Duração: ${minutos}:${segundosRestantes}`;
    }
  });

  function setPlaybackRate(rate) {
    audio.playbackRate = rate;

    if (currentSpeedLabel) {
      currentSpeedLabel.textContent = rate + "×";
    }

    speedSelect.value = String(rate);
  }

  setPlaybackRate(1);

  speedSelect.addEventListener("change", (evento) => {
    setPlaybackRate(
      parseFloat(evento.target.value) || 1
    );
  });

  if (increaseBtn) {
    increaseBtn.onclick = () => {
      setPlaybackRate(
        Math.min(audio.playbackRate + 0.25, 2)
      );
    };
  }

  if (decreaseBtn) {
    decreaseBtn.onclick = () => {
      setPlaybackRate(
        Math.max(audio.playbackRate - 0.25, 0.5)
      );
    };
  }

  if (downloadLink) {
    downloadLink.href = audio.src;
  }
}

function inicializarFAQ() {
  document
    .querySelectorAll(".faq-pergunta")
    .forEach((pergunta) => {
      pergunta.onclick = () => {
        const resposta =
          pergunta.nextElementSibling;

        if (resposta) {
          resposta.classList.toggle("ativo");
        }
      };
    });
}

function inicializarBotaoPlataformaRedacao() {
  const btn =
    document.getElementById(
      "btnPlataformaRedacao"
    );

  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href =
      "/app/frontend/index.html";
  });
}

function inicializarBuscaSite() {
  const input =
    document.getElementById("buscaSite");

  const sugestoes =
    document.getElementById("buscaSugestoes");

  if (!input || !sugestoes) return;

  carregarSearchIndex(() => {
    configurarBusca(input, sugestoes);
  });
}

function carregarSearchIndex(callback) {
  const script =
    document.createElement("script");

  script.src = "search-index.js";
  script.defer = true;
  script.onload = callback;

  document.head.appendChild(script);
}

function configurarBusca(input, sugestoes) {
  input.addEventListener("input", () => {
    const consulta =
      input.value.toLowerCase().trim();

    if (!consulta) {
      sugestoes.innerHTML = "";
      return;
    }

    const resultados =
      (window.SEARCH_INDEX || []).filter((item) =>
        item.title.toLowerCase().includes(consulta)
      );

    sugestoes.innerHTML = resultados
      .map(
        (resultado) =>
          `<div
            class="busca-item"
            onclick="location.href='${resultado.url}'"
          >
            ${resultado.title}
          </div>`
      )
      .join("");
  });
}

function mkToggleMenu() {
  const menu =
    document.getElementById("mkMenu");

  const overlay =
    document.querySelector(".menu-overlay");

  const botao =
    document.querySelector(".menu-toggle");

  if (!menu || !overlay || !botao) return;

  const aberto =
    menu.classList.toggle("active");

  overlay.classList.toggle(
    "active",
    aberto
  );

  overlay.setAttribute(
    "aria-hidden",
    String(!aberto)
  );

  botao.setAttribute(
    "aria-expanded",
    String(aberto)
  );

  botao.setAttribute(
    "aria-label",
    aberto ? "Fechar menu" : "Abrir menu"
  );

  if (!aberto) {
    fecharSubmenus(menu);
  }
}

function mkCloseMenu() {
  const menu =
    document.getElementById("mkMenu");

  const overlay =
    document.querySelector(".menu-overlay");

  const botao =
    document.querySelector(".menu-toggle");

  if (menu) {
    menu.classList.remove("active");
    fecharSubmenus(menu);
  }

  if (overlay) {
    overlay.classList.remove("active");

    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  if (botao) {
    botao.setAttribute(
      "aria-expanded",
      "false"
    );

    botao.setAttribute(
      "aria-label",
      "Abrir menu"
    );
  }
}

function inicializarMenuMobile() {
  document
    .querySelectorAll(".menu-fixo li")
    .forEach((item) => {
      const submenu =
        item.querySelector(":scope > ul");

      if (!submenu) return;

      item.classList.add("has-submenu");

      const acionador =
        item.querySelector(
          ":scope > .submenu-toggle"
        );

      if (acionador) {
        acionador.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
}

function fecharSubmenus(escopo = document) {
  escopo
    .querySelectorAll(
      "li.has-submenu.open"
    )
    .forEach((item) => {
      item.classList.remove("open");

      const acionador =
        item.querySelector(
          ":scope > .submenu-toggle"
        );

      if (acionador) {
        acionador.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
}

document.addEventListener("click", (evento) => {
  const acionador =
    evento.target.closest(
      ".menu-fixo .submenu-toggle"
    );

  if (!acionador) return;

  evento.preventDefault();

  const menuMobile =
    window.matchMedia(
      "(max-width: 900px)"
    ).matches;

  if (!menuMobile) return;

  const item = acionador.parentElement;

  if (!item) return;

  const submenu =
    item.querySelector(":scope > ul");

  if (!submenu) return;

  const abrir =
    !item.classList.contains("open");

  item.parentElement
    .querySelectorAll(
      ":scope > li.has-submenu.open"
    )
    .forEach((irmao) => {
      if (irmao === item) return;

      irmao.classList.remove("open");

      const acionadorIrmao =
        irmao.querySelector(
          ":scope > .submenu-toggle"
        );

      if (acionadorIrmao) {
        acionadorIrmao.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });

  item.classList.toggle("open", abrir);

  acionador.setAttribute(
    "aria-expanded",
    String(abrir)
  );
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    mkCloseMenu();
  }
});

const mediaMenuMobile =
  window.matchMedia("(max-width: 900px)");

const aoAlterarLarguraDoMenu = (evento) => {
  if (!evento.matches) {
    mkCloseMenu();
  }
};

if (
  typeof mediaMenuMobile.addEventListener ===
  "function"
) {
  mediaMenuMobile.addEventListener(
    "change",
    aoAlterarLarguraDoMenu
  );
} else {
  mediaMenuMobile.addListener(
    aoAlterarLarguraDoMenu
  );
}

document.addEventListener("click", (evento) => {
  const linkDireto =
    evento.target.closest(
      ".menu-fixo a:not(.submenu-toggle)"
    );

  if (
    linkDireto &&
    mediaMenuMobile.matches
  ) {
    mkCloseMenu();
  }
});

document.addEventListener("DOMContentLoaded", function () {

  const botaoVerificar = document.querySelector(".quiz-verificar");
  const resultadoDiv = document.querySelector(".quiz-resultado");
  const formularios = document.querySelectorAll(".quiz-form");

  if (!botaoVerificar || formularios.length === 0) return;

  botaoVerificar.addEventListener("click", function () {
    let acertos = 0;
    let total = formularios.length;

    
    document.querySelectorAll(".quiz-pergunta").forEach(q => {
      q.classList.remove("correta", "incorreta");
    });

    formularios.forEach(form => {
      const respostaCorreta = form.getAttribute("data-resposta");
      const nomeCampo = form.querySelector("input[type='radio']").name;
      const selecionado = form.querySelector(`input[name="${nomeCampo}"]:checked`);

      if (selecionado) {
        const valor = selecionado.value;
        const container = form.closest(".quiz-pergunta");

        if (valor === respostaCorreta) {
          acertos++;
          container.classList.add("correta");
        } else {
          container.classList.add("incorreta");
        }
      }
    });

   
    const percentual = Math.round((acertos / total) * 100);
    let mensagem = "";

    if (percentual === 100) {
      mensagem = "Excelente! Você dominou a interpretação textual! 🎯";
    } else if (percentual >= 80) {
      mensagem = "Muito bom! Continue praticando para alcançar a perfeição! 💪";
    } else if (percentual >= 60) {
      mensagem = "Bom desempenho! Revise os pontos em que teve dúvida. 📘";
    } else if (percentual >= 30) {
      mensagem = "Você está no caminho. Que tal revisar as estratégias de leitura? 📖";
    } else {
      mensagem = "Vamos praticar mais! Leia com atenção as dicas e tente novamente. 🔄";
    }

    resultadoDiv.innerHTML = `
      <div class="quiz-feedback">
        <p><strong>Você acertou ${acertos} de ${total} questões (${percentual}%).</strong></p>
        <p>${mensagem}</p>
      </div>
    `;

    resultadoDiv.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});
document.addEventListener("DOMContentLoaded", function () {

  const botaoVerificar = document.querySelector(".quiz-verificar");
  const resultadoDiv = document.querySelector(".quiz-resultado");
  const formularios = document.querySelectorAll(".quiz-form");
  const gabarito = document.querySelector(".gabarito-comentado"); // 🔹 novo

  if (!botaoVerificar || formularios.length === 0) return;

  botaoVerificar.addEventListener("click", function () {
    let acertos = 0;
    let total = formularios.length;

   
    document.querySelectorAll(".quiz-pergunta").forEach(q => {
      q.classList.remove("correta", "incorreta");
    });

    formularios.forEach(form => {
      const respostaCorreta = form.getAttribute("data-resposta");
      const nomeCampo = form.querySelector("input[type='radio']").name;
      const selecionado = form.querySelector(`input[name="${nomeCampo}"]:checked`);

      if (selecionado) {
        const valor = selecionado.value;
        const container = form.closest(".quiz-pergunta");

        if (valor === respostaCorreta) {
          acertos++;
          container.classList.add("correta");
        } else {
          container.classList.add("incorreta");
        }
      }
    });

    
    const percentual = Math.round((acertos / total) * 100);
    let mensagem = "";

    if (percentual === 100) {
      mensagem = "Excelente! Você dominou a interpretação textual! 🎯";
    } else if (percentual >= 80) {
      mensagem = "Muito bom! Continue praticando para alcançar a perfeição! 💪";
    } else if (percentual >= 60) {
      mensagem = "Bom desempenho! Revise os pontos em que teve dúvida. 📘";
    } else if (percentual >= 30) {
      mensagem = "Você está no caminho. Que tal revisar as estratégias de leitura? 📖";
    } else {
      mensagem = "Vamos praticar mais! Leia com atenção as dicas e tente novamente. 🔄";
    }

    resultadoDiv.innerHTML = `
      <div class="quiz-feedback">
        <p><strong>Você acertou ${acertos} de ${total} questões (${percentual}%).</strong></p>
        <p>${mensagem}</p>
      </div>
    `;

    resultadoDiv.scrollIntoView({ behavior: "smooth", block: "center" });

   
    if (gabarito) {
      gabarito.style.display = "block";
      gabarito.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});
