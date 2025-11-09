
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
incluirHTML('javascript', 'javascript.js');
    
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

