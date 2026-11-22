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
//comentário
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

document.addEventListener("DOMContentLoaded", () => {
  // Estrutura agrupando os dois cards de produtos
  const cardsProdutos = `
    <!-- Anúncio 1: Colleen Hoover -->
    <div style="display: flex; flex-wrap: wrap; align-items: center; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 32px 0 16px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-family: sans-serif;">
      <img src="https://m.media-amazon.com/images/I/71sdFEHoRGL._SY342_.jpg" alt="Kit: É Assim que Acaba + É Assim que Começa" style="width: 100px; min-width: 100px; height: auto; margin-right: 20px; margin-bottom: 10px; border-radius: 4px;">
      <div style="display: flex; flex-direction: column; flex: 1; min-width: 200px;">
        <h3 style="color: #1e3a8a; font-size: 1.2rem; margin: 0 0 8px 0;">Kit: É Assim que Acaba + É Assim que Começa</h3>
        <p style="color: #555555; font-size: 0.95rem; margin: 0 0 16px 0; line-height: 1.4;">Edição em capa comum de um dos maiores sucessos literários do momento.</p>
        <a href="https://link.amazon/B06PAlgjq" target="_blank" rel="noopener noreferrer" style="background-color: #ff8c00; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; text-align: center; width: fit-content; transition: background-color 0.3s;">
          Ver na Amazon
        </a>
      </div>
    </div>

    <!-- Anúncio 2: George Orwell -->
    <div style="display: flex; flex-wrap: wrap; align-items: center; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 0 0 32px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-family: sans-serif;">
      <img src="https://a.co/d/00PR90iN" alt="Biblioteca George Orwell - Box com 02 Livros" style="width: 100px; min-width: 100px; height: auto; margin-right: 20px; margin-bottom: 10px; border-radius: 4px;">
      <div style="display: flex; flex-direction: column; flex: 1; min-width: 200px;">
        <h3 style="color: #1e3a8a; font-size: 1.2rem; margin: 0 0 8px 0;">Biblioteca George Orwell - Box com 02 Livros</h3>
        <p style="color: #555555; font-size: 0.95rem; margin: 0 0 16px 0; line-height: 1.4;">Edição de luxo em capa dura. Clássico essencial para repertório de redação e análises críticas.</p>
        <a href="https://link.amazon/B0gkcJprG" target="_blank" rel="noopener noreferrer" style="background-color: #ff8c00; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; text-align: center; width: fit-content; transition: background-color 0.3s;">
          Ver na Amazon
        </a>
      </div>
    </div>
  `;

  // Seleciona os parágrafos do artigo
  const paragrafos = document.querySelectorAll('article p');

  // Injeta os dois anúncios juntos no meio do texto
  if (paragrafos.length > 3) {
    const meioDoTexto = Math.floor(paragrafos.length / 2);
    paragrafos[meioDoTexto].insertAdjacentHTML('afterend', cardsProdutos);
  }
});

/* Gabarita Paes — mensagem de boa prova. */
;(() => {
  'use strict';

  const config = {
    enabled: true,
    startsAt: '2026-11-22T03:00:00.000Z',
    endsAt: '2026-11-23T03:00:00.000Z',
    brand: 'Gabarita Paes · por Mestre Kira',
    badge: 'PAES UEMA · É hoje!',
    title: 'Respire fundo. Boa prova!',
    description:
      'Hoje é o momento de colocar seus conhecimentos em prática. Leia com atenção, organize seu tempo e enfrente uma questão de cada vez. Se surgir uma dificuldade, respire e siga com calma.',
    closing:
      'Que você consiga demonstrar tudo o que aprendeu. Estamos na torcida por você!',
    logo: 'https://www.mestrekira.com.br/logo1.png',
    excludedPaths: ['/gabarita-paes', '/app'],
  };

  function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (texto != null) elemento.textContent = texto;

    return elemento;
  }

  function renderizar() {
    const inicio = Date.parse(config.startsAt);
    const fim = Date.parse(config.endsAt);
    const agora = Date.now();

    if (
      !config.enabled ||
      agora < inicio ||
      agora >= fim ||
      document.getElementById('mk-gabarita-banner')
    ) {
      return;
    }

    const caminho = window.location.pathname.toLowerCase();

    if (
      config.excludedPaths.some(
        prefixo =>
          caminho === prefixo ||
          caminho.startsWith(prefixo + '/')
      )
    ) {
      return;
    }

    const host = criar('div');
    host.id = 'mk-gabarita-banner';
    host.setAttribute('role', 'complementary');
    host.setAttribute('aria-label', 'Mensagem de boa prova');

    const root = host.attachShadow({ mode: 'open' });
    const estilo = criar('style');

    estilo.textContent = `
      :host {
        display: block;
        width: 100%;
        max-width: 1040px;
        min-width: 0;
        margin: 28px auto;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      .mensagem {
        position: relative;
        padding: clamp(22px, 4vw, 36px);
        border: 1px solid #dbe4f4;
        border-top: 4px solid #eab308;
        border-radius: 18px;
        background: linear-gradient(120deg, #f8faff, #eff6ff);
        color: #172554;
        box-shadow: 0 6px 22px #1725540a;
        font: 16px/1.7 system-ui, -apple-system,
          "Segoe UI", sans-serif;
        overflow-wrap: anywhere;
      }

      .marca {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        color: #475569;
        font-size: 13px;
        font-weight: 650;
      }

      .logo {
        display: block;
        width: 36px;
        height: 36px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .selo {
        display: inline-block;
        padding: 5px 12px;
        margin-bottom: 12px;
        border-radius: 999px;
        background: #fef3c7;
        color: #713f12;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.5;
      }

      h2 {
        margin: 0 0 14px;
        color: #1e3a8a;
        font-size: clamp(26px, 4vw, 38px);
        line-height: 1.2;
        letter-spacing: -.025em;
      }

      .descricao {
        max-width: 780px;
        margin: 0;
        color: #334155;
      }

      .encerramento {
        margin: 20px 0 0;
        padding-top: 18px;
        border-top: 1px solid #dbe4f4;
        color: #1e3a8a;
        font-weight: 700;
      }

      @media (max-width: 600px) {
        :host {
          margin: 20px auto;
        }

        .mensagem {
          padding: 22px 18px;
          border-radius: 12px;
          font-size: 15px;
        }

        .marca {
          font-size: 12px;
          margin-bottom: 16px;
        }
      }
    `;

    const mensagem = criar('div', 'mensagem');
    const marca = criar('div', 'marca');
    const logo = criar('img', 'logo');

    logo.alt = '';
    logo.width = 36;
    logo.height = 36;
    logo.addEventListener(
      'error',
      () => logo.remove(),
      { once: true }
    );
    logo.src = config.logo;

    marca.append(
      logo,
      criar('span', '', config.brand)
    );

    mensagem.append(
      marca,
      criar('span', 'selo', config.badge),
      criar('h2', '', config.title),
      criar('p', 'descricao', config.description),
      criar('p', 'encerramento', config.closing)
    );

    root.append(estilo, mensagem);

    const slot = document.querySelector('[data-gabarita-banner]');

    if (slot) {
      slot.append(host);
    } else {
      const principal =
        document.querySelector('main') ||
        document.querySelector('article');

      if (principal) {
        const titulo = principal.querySelector('h1');

        if (titulo) titulo.after(host);
        else principal.prepend(host);
      } else {
        const cabecalho = document.querySelector('body > header');

        if (cabecalho) cabecalho.after(host);
        else document.body.prepend(host);
      }
    }

    // Remove a mensagem também de uma página que permaneça aberta.
    const timer = setTimeout(
      () => host.remove(),
      Math.max(0, fim - Date.now())
    );

    function conferirPrazo() {
      if (Date.now() >= fim) {
        host.remove();
        clearTimeout(timer);
        document.removeEventListener(
          'visibilitychange',
          conferirPrazo
        );
      }
    }

    document.addEventListener(
      'visibilitychange',
      conferirPrazo
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      renderizar,
      { once: true }
    );
  } else {
    renderizar();
  }
})();
