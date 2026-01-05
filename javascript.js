
function incluirHTML(id, url, callback) {
    fetch(url)
        .then(res => res.text())
        .then(data => {
            document.getElementById(id).innerHTML = data;
            if (callback) callback();
        })
        .catch(erro => console.error('Erro ao carregar ' + url, erro));
}

incluirHTML('header', 'header.html', configurarLinks);
incluirHTML('aside', 'aside.html');
incluirHTML('footer', 'footer.html');

    
function configurarLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            const destino = this.getAttribute('href').replace("#", "").toLowerCase();

            const destinosValidos = [
               
                "fonetica", "fonologia", "morfologia", "sintaxe", "semantica", "pragmatica",
                "literatura-portuguesa", "literatura-brasileira", "literatura-africana-portuguesa",
                "critica", "midiatico",
                "gramatica", "producaotextual", "interpretacaotextual"
            ];

            if (destinosValidos.includes(destino)) {
                e.preventDefault();
                window.location.href = `conteudos${destino}.html`;
            }
        });
    });
}

	
document.addEventListener("DOMContentLoaded", function() {
    const posts = document.querySelectorAll(".publicacoes .post");
    const porPagina = 20; 
    const totalPaginas = Math.ceil(posts.length / porPagina);
    let paginaAtual = 1;

    function mostrarPagina(pagina) {
       
        posts.forEach(p => p.style.display = "none");

        
        const inicio = (pagina - 1) * porPagina;
        const fim = inicio + porPagina;
        for (let i = inicio; i < fim && i < posts.length; i++) {
            posts[i].style.display = "block";
        }

       
        atualizarPaginacao();
    }

    function atualizarPaginacao() {
        const paginacaoDiv = document.getElementById("paginacao");
        paginacaoDiv.innerHTML = "";

        
        if (paginaAtual > 1) {
            const anterior = document.createElement("button");
            anterior.textContent = "← Página anterior";
            anterior.onclick = () => {
                paginaAtual--;
                mostrarPagina(paginaAtual);
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
                paginaAtual++;
                mostrarPagina(paginaAtual);
                window.scrollTo({ top: 0, behavior: "smooth" });
            };
            paginacaoDiv.appendChild(proxima);
        }
    }

  
    mostrarPagina(paginaAtual);
});
(function () {
  const audio = document.getElementById('playerAudio');
  const speedSelect = document.getElementById('speedSelect');
  const currentSpeedLabel = document.getElementById('currentSpeedLabel');
  const increaseBtn = document.getElementById('increaseSpeed');
  const decreaseBtn = document.getElementById('decreaseSpeed');
  const audioDuration = document.getElementById('audioDuration');
  const downloadLink = document.getElementById('downloadLink');

  audio.addEventListener('loadedmetadata', () => {
    if (!isNaN(audio.duration)) {
      const sec = Math.round(audio.duration);
      const mm = Math.floor(sec / 60).toString().padStart(2, '0');
      const ss = (sec % 60).toString().padStart(2, '0');
      audioDuration.textContent = `Duração: ${mm}:${ss}`;
    }
  });

  function setPlaybackRate(rate) {
    audio.playbackRate = rate;
    currentSpeedLabel.textContent = rate + '×';
    speedSelect.value = String(rate);
  }

  setPlaybackRate(1);

  speedSelect.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value) || 1;
    setPlaybackRate(val);
  });

  const speedOptions = Array.from(speedSelect.options).map(o => parseFloat(o.value));

  function stepSpeed(direction) {
    const current = parseFloat(speedSelect.value) || 1;
    let idx = speedOptions.indexOf(current);

    if (idx === -1) {
      idx = speedOptions.reduce((acc, v, i) =>
        Math.abs(v - current) < Math.abs(speedOptions[acc] - current) ? i : acc,
      0);
    }

    const nextIdx = Math.min(Math.max(idx + direction, 0), speedOptions.length - 1);
    setPlaybackRate(speedOptions[nextIdx]);
  }

  increaseBtn.addEventListener('click', () => stepSpeed(+1));
  decreaseBtn.addEventListener('click', () => stepSpeed(-1));

  downloadLink.href = audio.src;

  document.addEventListener('keydown', (ev) => {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    if (ev.key === '[') { stepSpeed(-1); ev.preventDefault(); }
    if (ev.key === ']') { stepSpeed(+1); ev.preventDefault(); }
  });
})();

document.querySelectorAll('.faq-pergunta').forEach(pergunta => {
  pergunta.addEventListener('click', () => {
    const resposta = pergunta.nextElementSibling;
    resposta.classList.toggle('ativo');
  });
});

  document
    .getElementById('btnPlataformaRedacao')
    .addEventListener('click', () => {
      window.location.href = '/app/';
    });

