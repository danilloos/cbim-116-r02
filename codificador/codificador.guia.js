/* Guia para quem chega: números da concessão, caminho Zona > TH > Obrigação > documento e anatomia de um código real.
   Tudo calculado de dados.js e geo.js (nada digitado à mão). Movimento só com prefers-reduced-motion: no-preference. */
(function () {
  'use strict';
  const D = window.SRT_DADOS, G = window.SRT_GEO, C = window.CCSCore;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- números ---------- */
  const kmEixo = G ? Math.round(G.municipios.flatMap(m => m.trechos).reduce((a, t) => a + (t.kf - t.ki), 0)) : null;
  const numeros = [
    [kmEixo, 'km de rodovia', 'eixo SNV 202607A'],
    [D.rodovias.length, 'rodovias', D.rodovias.map(r => r.nome).join(', ')],
    [G ? G.municipios.length : null, 'municípios', 'cortados pela rodovia'],
    [D.zonas.filter(z => z.kmIni != null).length, 'zonas de projeto', 'cada uma com um site'],
    [D.ths.length, 'trechos homogêneos', 'TH da Tabela 43 do PER'],
    [D.obrigacoes.length, 'obrigações', 'obras do PER na lista mestre'],
  ].filter(n => n[0] != null);
  $('numeros').replaceChildren(...numeros.map(([v, nome, det]) => {
    const li = el('li');
    const b = el('b', null, semMovimento ? String(v) : '0');
    b.dataset.alvo = v;
    li.append(b, el('span', null, nome), el('small', null, det));
    return li;
  }));
  function contar(b) {
    const alvo = Number(b.dataset.alvo), t0 = performance.now(), dur = 1300;
    const passo = t => {
      const f = Math.min((t - t0) / dur, 1);
      b.textContent = String(Math.round(alvo * (1 - Math.pow(1 - f, 3))));
      if (f < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  /* ---------- exemplo real: do território ao documento ---------- */
  const ex = D.obrigacoes.find(o => o.obra === 'DPL' && o.rodCod && o.kmFim != null && o.pasta !== 'EDIF') || D.obrigacoes.find(o => o.rodCod && o.kmIni != null);
  const z = D.zonas.find(x => x.id === ex.zona);
  const th = D.ths.find(t => t.pasta === ex.pasta);
  const fase = D.fases.find(f => f.proj === 'EXO') || D.fases[0];
  const disc = D.disciplinas.find(d => d.cod === 'GEO') || D.disciplinas[0];
  const cat = D.categorias.find(c => c.cod === 'PRC') || D.categorias[0];
  const passos = [
    ['Zona', `${z.id} ${z.nome}`, 'Recorte do território. Cada zona tem um site no SharePoint com as pastas de projeto.'],
    ['Trecho homogêneo', `${th ? th.th.replace('_', ' ') : ex.th} · pasta ${ex.pasta}`, 'Divisão do PER por características da via. A pasta junta o ano-âncora (A03 = 3º ano) e o número do TH.'],
    ['Obrigação', `${ex.id} · ${C.semTraco(ex.desc)}`, 'A obra que o contrato exige. O ID vem da lista mestre.'],
    ['Fase', `${fase.proj} · ${fase.nome}`, 'Etapa do projeto: estudo, funcional, anteprojeto, executivo, as built.'],
    ['Disciplina', `${disc.cod} · ${disc.nome}`, 'A especialidade do documento.'],
    ['Documento', `${cat.cod} · ${cat.nome}`, 'O tipo de entrega. Com número e revisão, fecha o nome.'],
  ];
  $('rota').replaceChildren(...passos.map(([nome, valor, ajuda], i) => {
    const li = el('li', 'rota__passo');
    li.style.setProperty('--i', i);
    li.append(el('span', 'rota__nome', nome), el('b', null, valor), el('small', null, ajuda));
    return li;
  }));

  /* ---------- anatomia do código ---------- */
  const rod = D.rodovias.find(r => r.cod === ex.rodCod);
  const bs = C.blocos({ rod: ex.rodCod, rodNome: rod && rod.nome, local: C.blocoLocal(ex.kmIni, ex.kmFim), obra: ex.obra, obraNome: ex.obraNome,
    proj: fase.proj, projNome: fase.nome, cat, disc, seq: '001', rev: 'R00' });
  const codigo = $('anatomia-codigo'), explica = $('anatomia-explica');
  function mostrar(i) {
    codigo.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const b = bs[i];
    explica.replaceChildren(el('b', null, `${b.nome}: ${b.v}`), el('span', null, b.ajuda));
  }
  bs.forEach((b, i) => {
    if (i) codigo.append(el('span', 'hifen', '-'));
    const bt = el('button', `peca peca--${b.k}`, b.v);
    bt.type = 'button';
    bt.style.setProperty('--i', i);
    bt.setAttribute('aria-pressed', 'false');
    bt.setAttribute('aria-label', `${b.nome}: ${b.v}`);
    ['mouseenter', 'focus', 'click'].forEach(ev => bt.addEventListener(ev, () => mostrar(i)));
    codigo.append(bt);
  });
  mostrar(2);
  $('anatomia-usar').addEventListener('click', () => {
    window.CodificadorApp?.selecionarObrigacao(ex.id);
    document.getElementById('sec-mapa').scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth' });
  });

  /* ---------- entrada das seções ---------- */
  const revela = [...document.querySelectorAll('.revela')];
  if (semMovimento || !('IntersectionObserver' in window)) { revela.forEach(r => r.classList.add('is-visible')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-visible');
    e.target.querySelectorAll('[data-alvo]').forEach(contar);
    io.unobserve(e.target);
  }), { threshold: 0.2 });
  revela.forEach(r => io.observe(r));
})();
