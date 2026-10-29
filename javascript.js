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
  badge: 'Reta final de preparação',
  title: 'PAES UEMA: transforme seus erros em revisão!',
  description: 'Descubra o que precisa revisar antes da prova. Faça simulados inéditos, pratique com questões do ENEM e aprimore sua redação com feedback por inteligência artificial. Acesso integral por R$ 24,99 durante 30 dias, sem renovação automática.',
  button: 'Quero me preparar',
  destination: 'https://www.mestrekira.com.br/gabarita-paes/cadastro.html',
  logo: 'https://www.mestrekira.com.br/logo1.png',
  excludedPaths: ['/gabarita-paes', '/app'],
};

  function render() {
    if (!config.enabled || document.getElementById('mk-gabarita-banner')) return;
    const path = window.location.pathname.toLowerCase();
    if (config.excludedPaths.some(prefix => path === prefix || path.startsWith(prefix + '/'))) return;

const host = document.createElement('div');
host.id = 'mk-gabarita-banner';
host.setAttribute('role', 'complementary');
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
