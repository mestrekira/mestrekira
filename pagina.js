document.addEventListener("DOMContentLoaded", function () {
  const submenus = document.querySelectorAll(".menu-fixo .submenu > a");

  submenus.forEach((submenu) => {
    submenu.addEventListener("click", function (e) {
      e.preventDefault();
      const submenuList = this.nextElementSibling;
      submenuList.classList.toggle("ativo");
    });
  });
});
document.addEventListener("DOMContentLoaded", function () {
  const submenus = document.querySelectorAll(".menu-fixo .submenu > a");

  submenus.forEach((submenu) => {
    submenu.addEventListener("click", function (e) {
      e.preventDefault();
      const submenuList = this.nextElementSibling;
      submenuList.classList.toggle("ativo");
    });
  });

  // Mostrar conteúdo "Criador" ao clicar no menu
  const linkCriador = document.querySelector('a[href="#criador"]');
  const secaoCriador = document.getElementById("criador-section");

  linkCriador.addEventListener("click", function (e) {
    e.preventDefault();
    secaoCriador.style.display =
      secaoCriador.style.display === "none" ? "block" : "none";
  });
});
