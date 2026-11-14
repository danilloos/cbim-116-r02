/* MAN-SIN-116 em HTML: barra de progresso e seção ativa no sumário. Sem dependência externa. */
(function () {
  "use strict";
  var reduz = window.matchMedia("(prefers-reduced-motion: reduce)");
  var larga = window.matchMedia("(min-width: 1024px)");
  var barra = document.getElementById("progresso");
  var caixa = document.getElementById("sumario-caixa");
  var links = [].slice.call(document.querySelectorAll(".sumario a[href^='#']"));
  var alvos = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var LINHA = 130; // px do topo da janela: a seção ativa é a última cujo início já passou desta linha
  var pendente = false;

  // Em tela estreita o sumário abre recolhido; em tela larga fica aberto e fixo.
  function ajustaCaixa() { if (caixa) { caixa.open = larga.matches; } }
  ajustaCaixa();
  if (larga.addEventListener) { larga.addEventListener("change", ajustaCaixa); }

  function progresso() {
    var h = document.documentElement;
    var total = h.scrollHeight - window.innerHeight;
    if (barra) { barra.style.width = (total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0) + "%"; }
  }

  function ativa() {
    var atual = -1;
    for (var i = 0; i < alvos.length; i++) {
      if (alvos[i] && alvos[i].getBoundingClientRect().top <= LINHA) { atual = i; } else if (alvos[i]) { break; }
    }
    links.forEach(function (a, i) {
      if (i === atual) {
        if (!a.classList.contains("ativo")) {
          a.classList.add("ativo");
          a.setAttribute("aria-current", "location");
          // acompanha a leitura no sumário fixo, sem animação se o usuário pediu menos movimento
          if (larga.matches && a.scrollIntoView) { a.scrollIntoView({ block: "nearest", behavior: reduz.matches ? "auto" : "smooth" }); }
        }
      } else if (a.classList.contains("ativo")) {
        a.classList.remove("ativo");
        a.removeAttribute("aria-current");
      }
    });
  }

  function atualiza() { pendente = false; progresso(); }
  window.addEventListener("scroll", function () {
    if (!pendente) { pendente = true; window.requestAnimationFrame(atualiza); }
  }, { passive: true });
  window.addEventListener("resize", atualiza);

  // Seção ativa: recalcula quando um início de seção cruza a linha de leitura, nos dois sentidos
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(ativa, { rootMargin: "-" + LINHA + "px 0px 0px 0px", threshold: [0, 1] });
    alvos.forEach(function (el) { if (el) { obs.observe(el); } });
  } else {
    window.addEventListener("scroll", ativa, { passive: true });
  }

  // Em tela estreita, escolher um item fecha o sumário
  links.forEach(function (a) {
    a.addEventListener("click", function () { if (caixa && !larga.matches) { caixa.open = false; } });
  });

  progresso();
  ativa();
})();
