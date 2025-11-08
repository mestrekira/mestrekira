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
