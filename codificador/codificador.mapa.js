/* Mapa da concessão no Codificador de Projetos 116 Sertões (Leaflet + bases OpenStreetMap).
   Dados: geo.js (gerar_geo_codificador.py) e dados.js. Conversa com o formulário por window.CodificadorApp e pelo evento srt:selecao. */
(function () {
  'use strict';
  const G = window.SRT_GEO, D = window.SRT_DADOS, C = window.CCSCore;
  const caixa = document.getElementById('mapa');
  if (!caixa) return;
  if (!window.L || !G) {  // CDN do Leaflet bloqueada ou geo.js ausente: o codificador segue funcionando sem mapa
    caixa.closest('.mapa-wrap').replaceWith(Object.assign(document.createElement('p'), { className: 'mapa__erro',
      textContent: 'O mapa não carregou (rede bloqueada ou arquivo ausente). O codificador abaixo funciona normalmente.' }));
    return;
  }
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = C.fmtKm;
  const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ENT[c]);  // texto da lista mestre dentro de tooltip HTML
  const zonaPorId = Object.fromEntries(D.zonas.map(z => [z.id, z]));
  const obrPorId = Object.fromEntries(D.obrigacoes.map(o => [o.id, o]));
  const COR_FAMILIA = { dpl: '#064B63', dis: '#C8553D', ace: '#2E7D5B', oae: '#9A6B00', edi: '#3D4A50', mop: '#16A6DC', out: '#617177' };

  /* ---------- mapa e bases abertas ---------- */
  const mapa = L.map(caixa, { zoomControl: false, scrollWheelZoom: false, preferCanvas: false, attributionControl: true });
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
  const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores do OpenStreetMap</a>';
  // só bases sem chave: tiles do OpenStreetMap (política de uso com atribuição), HOT e OpenTopoMap, todos com dados OSM
  const osm = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const bases = {
    'OpenStreetMap claro': L.tileLayer(osm, { maxZoom: 19, attribution: OSM, className: 'base-clara' }),
    'OpenStreetMap': L.tileLayer(osm, { maxZoom: 19, attribution: OSM }),
    'Humanitário (OSM HOT)': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc', attribution: `${OSM}, estilo <a href="https://www.hotosm.org/" target="_blank" rel="noopener">HOT</a>` }),
    'Relevo (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: `${OSM}, SRTM, estilo <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)` }),
  };
  bases['OpenStreetMap claro'].addTo(mapa);
  // roda do mouse só depois de clicar no mapa: rolar a página não pode virar zoom por acidente
  mapa.on('click', () => mapa.scrollWheelZoom.enable());
  caixa.addEventListener('mouseleave', () => mapa.scrollWheelZoom.disable());

  ['municipios', 'tus', 'zonas', 'ths', 'obrig', 'divisas', 'sel'].forEach((n, i) => { mapa.createPane(n).style.zIndex = 380 + i * 10; });
  const ll = g => (g.t === 'p' ? [g.c] : g.c.flat());
  const desenho = (g, estilo, pane) => (g.t === 'p'
    ? L.circleMarker(g.c, { pane, radius: 6, ...estilo })
    : L.polyline(g.c, { pane, ...estilo }));

  /* ---------- camadas de referência ---------- */
  const camMunicipios = L.layerGroup(), camRotulos = L.layerGroup(), camDivisas = L.layerGroup(), camTus = L.layerGroup();
  G.municipios.forEach(m => {
    L.polygon(m.aneis, { pane: 'municipios', color: '#617177', weight: 1, dashArray: '4 4', fillColor: '#064B63', fillOpacity: 0.03, interactive: false }).addTo(camMunicipios);
    m.trechos.filter(t => t.meio).forEach(t => {
      L.marker(t.meio, { pane: 'divisas', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'rotulo-muni', html: `<span>${esc(m.nome)}<small>${esc(m.uf)}</small></span>`, iconSize: null }) }).addTo(camRotulos);
    });
  });
  G.divisas.forEach(d => {
    L.circleMarker(d.c, { pane: 'divisas', radius: d.uf ? 7 : 4.5, color: '#064B63', weight: 2, fillColor: d.uf ? '#F5BA00' : '#fff', fillOpacity: 1 })
      .bindTooltip(`<b>${d.uf ? 'Divisa de estado' : 'Divisa municipal'}</b><br>${esc(d.de)} | ${esc(d.para)}<br>${esc(d.rod)} km SNV ${fmt(d.km)}`, { direction: 'top' })
      .addTo(camDivisas);
  });
  G.tus.forEach(t => {
    L.polyline(t.g.c, { pane: 'tus', color: '#16A6DC', weight: 16, opacity: 0.22, lineCap: 'butt' })
      .bindTooltip(`<b>Travessia urbana</b><br>${esc(t.nome)}<br>${esc(t.rod)} km SNV ${fmt(t.ki)} a ${fmt(t.kf)}`, { sticky: true })
      .addTo(camTus);
  });

  const camZonas = L.layerGroup().addTo(mapa);
  const linhasZona = {};
  G.zonas.forEach(z => {
    const casco = L.polyline(z.g.c, { pane: 'zonas', color: '#fff', weight: 11, opacity: 0.9, interactive: false });
    const linha = L.polyline(z.g.c, { pane: 'zonas', color: z.cor, weight: 7, opacity: 0.8, className: 'zona-linha' });
    const dica = `<b>${esc(z.id)}</b> ${esc(z.nome)}`;
    linha.bindTooltip(dica, { sticky: true });
    linha.on('mousemove', ev => { const th = thSobMouse(z.id, ev.latlng); linha.setTooltipContent(th ? `${dica}<br>${th}` : dica); });
    linha.on('click', () => { window.CodificadorApp?.selecionarZona(z.id); mostrarZona(z.id); });
    linhasZona[z.id] = linha;
    camZonas.addLayer(casco).addLayer(linha);
  });
  // TH: linha fina tracejada sobre a zona, sem capturar o ponteiro (o clique é da zona); o TH sob o mouse entra no tooltip da zona
  const camThs = L.layerGroup().addTo(mapa);
  const linhasTh = {};
  const thsDaZona = {};
  G.ths.forEach(t => {
    const linha = L.polyline(t.g.c, { pane: 'ths', color: '#fff', weight: 1.5, opacity: 0.9, dashArray: '2 6', interactive: false });
    linhasTh[`${t.zona}|${t.pasta}`] = linha;
    (thsDaZona[t.zona] = thsDaZona[t.zona] || []).push(t);
    camThs.addLayer(linha);
  });
  const PX_TH = 24;
  function thSobMouse(zona, latlng) {
    if (!mapa.hasLayer(camThs)) return '';
    const p = mapa.latLngToLayerPoint(latlng);
    let melhor = null, dist = PX_TH;
    for (const t of thsDaZona[zona] || []) {
      for (const parte of t.g.c) {
        for (let i = 1; i < parte.length; i++) {
          const d = L.LineUtil.pointToSegmentDistance(p, mapa.latLngToLayerPoint(parte[i - 1]), mapa.latLngToLayerPoint(parte[i]));
          if (d < dist) { dist = d; melhor = t; }
        }
      }
    }
    return melhor ? `${esc(melhor.th.replace('_', ' '))}${melhor.pasta ? ` · pasta ${esc(melhor.pasta)}` : ' · sem pasta de projeto'}` : '';
  }

  /* ---------- obrigações por família ---------- */
  const camObr = L.layerGroup().addTo(mapa);
  const desenhoObr = {};
  const ativas = new Set(C.FAMILIAS.map(f => f.k).concat('out'));
  D.obrigacoes.forEach(o => {
    const g = G.obr[o.id];
    if (!g) return;
    const cor = COR_FAMILIA[C.familia(o.obra)];
    const d = desenho(g, g.t === 'p'
      ? { color: '#fff', weight: 1.5, fillColor: cor, fillOpacity: 1, radius: 6 }
      : { color: cor, weight: 4.5, opacity: 0.95, lineCap: 'round' }, 'obrig');
    d.bindTooltip(`<b>${esc(C.semTraco(o.desc))}</b><br>${esc(o.id)} · ${esc(o.obraNome)}`, { sticky: g.t !== 'p', direction: 'top' });
    d.on('click', () => {
      const ok = window.CodificadorApp?.selecionarObrigacao(o.id);
      mostrarObrigacao(o.id);
      if (ok) avisarEscolha(o);
    });
    desenhoObr[o.id] = { d, o, g };
  });

  function aplicarFiltros(zona) {
    camObr.clearLayers();
    Object.values(desenhoObr).forEach(({ d, o, g }) => {
      if (!ativas.has(C.familia(o.obra))) return;
      const fora = zona && o.zona !== zona;
      if (g.t === 'p') d.setStyle({ fillOpacity: fora ? 0.25 : 1, opacity: fora ? 0.3 : 1 });
      else d.setStyle({ opacity: fora ? 0.22 : 0.95 });
      camObr.addLayer(d);
    });
    Object.entries(linhasZona).forEach(([id, l]) => l.setStyle({ opacity: !zona || id === zona ? 0.8 : 0.25 }));
  }

  /* ---------- painel: filtros, camadas e zonas ---------- */
  const filtros = $('mapa-filtros');
  const contagem = k => D.obrigacoes.filter(o => G.obr[o.id] && C.familia(o.obra) === k).length;
  C.FAMILIAS.forEach(f => {
    const n = contagem(f.k);
    if (!n) return;
    const b = el('button', 'filtro');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'true');
    b.style.setProperty('--cor', COR_FAMILIA[f.k]);
    b.append(el('i'), el('span', null, f.nome), el('small', null, String(n)));
    b.title = `Tipos: ${f.obras.join(', ')}`;
    b.addEventListener('click', () => {
      const liga = !ativas.has(f.k);
      if (liga) ativas.add(f.k); else ativas.delete(f.k);
      b.setAttribute('aria-pressed', String(liga));
      rotuloTodos();
      aplicarFiltros(zonaAtual);
    });
    filtros.append(b);
  });
  function rotuloTodos() { $('mapa-todos').textContent = filtros.querySelectorAll('[aria-pressed=false]').length ? 'Mostrar todas' : 'Ocultar todas'; }
  $('mapa-todos').addEventListener('click', () => {
    const tudo = filtros.querySelectorAll('[aria-pressed=false]').length > 0;
    C.FAMILIAS.map(f => f.k).concat('out').forEach(k => (tudo ? ativas.add(k) : ativas.delete(k)));  // 'out' sem botão (o teste garante 0), mas some junto
    filtros.querySelectorAll('.filtro').forEach(b => b.setAttribute('aria-pressed', String(tudo)));
    rotuloTodos();
    aplicarFiltros(zonaAtual);
  });

  const camadas = { 'cam-municipios': [camMunicipios, camDivisas, camRotulos], 'cam-tus': [camTus], 'cam-ths': [camThs] };
  Object.entries(camadas).forEach(([id, grupos]) => {
    const cb = $(id);
    const sinc = () => grupos.forEach(g => (cb.checked ? g.addTo(mapa) : g.remove()));
    cb.addEventListener('change', sinc);
    sinc();
  });
  L.control.layers(bases, null, { position: 'topright', collapsed: true }).addTo(mapa);

  const legenda = $('mapa-zonas');
  G.zonas.forEach(z => {
    const b = el('button', 'zona-leg');
    b.type = 'button';
    b.style.setProperty('--cor', z.cor);
    b.append(el('i'), el('b', null, z.id), el('span', null, z.nome));
    b.addEventListener('click', () => { mostrarZona(z.id); window.CodificadorApp?.selecionarZona(z.id); enquadrar(linhasZona[z.id].getBounds()); });
    legenda.append(b);
  });

  /* ---------- ficha do que está selecionado ---------- */
  const ficha = $('mapa-ficha');
  const linhaFicha = (k, v) => { const p = el('p'); p.append(el('b', null, k), ` ${v}`); return p; };
  function municipiosDaZona(z) {
    if (z.kmIni == null) return [];
    return G.municipios.filter(m => m.trechos.some(t => t.rod === z.rodovia && t.ki < z.kmFim && t.kf > z.kmIni)).map(m => m.nome);
  }
  function mostrarZona(id) {
    const z = zonaPorId[id], gz = G.zonas.find(x => x.id === id);
    if (!z) return;
    const n = D.obrigacoes.filter(o => o.zona === id).length;
    const munis = municipiosDaZona(z);
    ficha.replaceChildren(el('p', 'ficha__tipo', 'Zona do acervo'), el('h3', null, `${z.id} ${z.nome}`),
      ...(z.kmIni != null && z.rodovia !== 'Contorno de Serrinha' ? [linhaFicha('Trecho:', `${z.rodovia} km SNV ${fmt(z.kmIni)} a ${fmt(z.kmFim)}`)] : [linhaFicha('Trecho:', z.rodovia)]),
      linhaFicha('Obrigações do PER:', String(n)),
      ...(munis.length ? [linhaFicha('Municípios:', munis.join(', '))] : []),
      linhaFicha('Site SharePoint:', z.site));
    ficha.style.setProperty('--cor', gz ? gz.cor : '#064B63');
    ficha.hidden = false;
  }
  function mostrarObrigacao(id) {
    const o = obrPorId[id];
    if (!o) return;
    const z = zonaPorId[o.zona];
    const km = o.kmIni == null ? 'localização a definir' : `${o.rodovia} km SNV ${fmt(o.kmIni)}${o.kmFim != null ? ` a ${fmt(o.kmFim)}` : ''}`;
    const usar = el('button', 'botao botao--peq', 'Usar no codificador');
    usar.type = 'button';
    usar.addEventListener('click', () => { if (window.CodificadorApp?.selecionarObrigacao(o.id)) { avisarEscolha(o); $('campo-fase').querySelector('input')?.focus(); } });
    ficha.replaceChildren(el('p', 'ficha__tipo', o.obraNome), el('h3', null, `${C.semTraco(o.desc)}${o.subtipo ? ` (${C.semTraco(o.subtipo)})` : ''}`),
      linhaFicha('ID:', o.id), linhaFicha('Zona e pasta:', `${z.titulo} · ${o.pasta}`), linhaFicha('Local:', km),
      ...(o.kmPer ? [linhaFicha('km PER (provisório):', `${fmt(o.kmPer[0])}${o.kmPer[1] != null ? ` a ${fmt(o.kmPer[1])}` : ''}`)] : []),
      ...(o.anoObra ? [linhaFicha('Ano de obra no PER:', o.anoObra)] : []),
      ...(o.obs ? [el('p', 'ficha__obs', C.semTraco(o.obs))] : []), usar);
    ficha.style.setProperty('--cor', COR_FAMILIA[C.familia(o.obra)]);
    ficha.hidden = false;
  }
  function avisarEscolha(o) {
    const t = $('mapa-toast');
    t.textContent = `${o.id} escolhida no passo 1. Siga para a fase.`;
    t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on');
  }

  /* ---------- reação ao formulário ---------- */
  const camSel = L.layerGroup().addTo(mapa);
  let zonaAtual = null;
  // a ficha cobre o canto superior esquerdo no desktop: o enquadramento desconta a largura dela
  const folga = () => (ficha.hidden || ficha.offsetParent === null || getComputedStyle(ficha).position !== 'absolute' ? [40, 40] : [ficha.offsetWidth + 56, 40]);
  const enquadrar = b => {
    const op = { paddingTopLeft: folga(), paddingBottomRight: [40, 40], maxZoom: 14 };
    return semMovimento ? mapa.fitBounds(b, op) : mapa.flyToBounds(b, { ...op, duration: 0.9 });
  };
  function destacar(det) {
    camSel.clearLayers();
    zonaAtual = det.zona;
    aplicarFiltros(det.zona);
    const alvo = det.obr && desenhoObr[det.obr];
    if (alvo) {
      const { g } = alvo;
      if (g.t === 'p') L.marker(g.c, { pane: 'sel', interactive: false, icon: L.divIcon({ className: 'halo', iconSize: [34, 34] }) }).addTo(camSel);
      else L.polyline(g.c, { pane: 'sel', color: '#F5BA00', weight: 12, opacity: 0.6, interactive: false, className: 'halo-linha' }).addTo(camSel);
      mostrarObrigacao(det.obr);
      enquadrar(L.latLngBounds(ll(g)).pad(g.t === 'p' ? 0 : 0.15));
      return;
    }
    if (det.zona) mostrarZona(det.zona); else ficha.hidden = true;
    const th = det.thPasta && linhasTh[`${det.zona}|${det.thPasta}`];
    if (th) {
      L.polyline(th.getLatLngs(), { pane: 'sel', color: '#F5BA00', weight: 10, opacity: 0.5, interactive: false }).addTo(camSel);
      enquadrar(th.getBounds());
    } else if (det.zona && linhasZona[det.zona]) enquadrar(linhasZona[det.zona].getBounds());
  }
  let pendente = null;
  document.addEventListener('srt:selecao', ev => {  // a cascata dispara várias vezes seguidas: só vale a última do quadro
    pendente = ev.detail;
    requestAnimationFrame(() => { if (pendente) { destacar(pendente); pendente = null; } });
  });
  $('mapa-geral').addEventListener('click', () => enquadrar(camZonas.getLayers().reduce((b, l) => b.extend(l.getBounds()), L.latLngBounds([]))));

  /* ---------- rótulos dos municípios só de perto; entrada desenhando a rodovia ---------- */
  const sincZoom = () => caixa.classList.toggle('mapa--perto', mapa.getZoom() >= 9);
  mapa.on('zoomend', sincZoom);
  mapa.fitBounds(camZonas.getLayers().reduce((b, l) => b.extend(l.getBounds()), L.latLngBounds([])), { padding: [24, 24] });
  sincZoom();
  aplicarFiltros(null);
  if (!semMovimento && 'IntersectionObserver' in window) {
    const paths = Object.values(linhasZona).map(l => l.getElement()).filter(Boolean);
    paths.forEach(p => { p.setAttribute('pathLength', '1'); p.classList.add('tracar'); });
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      paths.forEach((p, i) => {
        p.style.animationDelay = `${i * 120}ms`;
        p.classList.add('tracar--on');
        p.addEventListener('animationend', () => { p.classList.remove('tracar', 'tracar--on'); p.removeAttribute('pathLength'); p.style.animationDelay = ''; }, { once: true });
      });
    }, { threshold: 0.35 });
    io.observe(caixa);
  }
  const ja = window.CodificadorApp?.estado();  // link ?obr= escolhido antes de o mapa existir
  if (ja && ja.zona) destacar({ zona: ja.zona, thPasta: ja.thPasta, obr: ja.obr ? ja.obr.id : null });
  $('mapa-fonte').textContent = `Bases: ${G.fonte}. Fundo do mapa: OpenStreetMap (ODbL).`;
})();
