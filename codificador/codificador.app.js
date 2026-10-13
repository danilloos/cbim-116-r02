/* Interface do Codificador de Projetos 116 Sertões. Regras em codificador.core.js; dados em dados.js (gerar_codificador.py). */
(function () {
  'use strict';
  const D = window.CCS_DADOS;
  const C = window.CCSCore;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const MAX_LISTA = 80;

  const zonaPorId = Object.fromEntries(D.zonas.map(z => [z.id, z]));
  const segPorPasta = Object.fromEntries(D.segmentos.map(s => [s.pasta, s]));
  const obraNome = Object.fromEntries(D.tiposObra.map(o => [o.cod, o.nome]));
  const OBRAS_EDIF = new Set(D.tramos.filter(t => t.lib === 'CDEEDIF').map(t => t.obra));
  const snvTexto = s => String(s || '').replace(/[–—]/g, ' a ');

  const estado = { tramo: null, manual: false, obraManual: null, fase: null, disc: null, cat: null };

  /* ---------- campo de busca acessível (combobox com lista filtrada) ---------- */
  let seqCampo = 0;
  function criarCampo(destino, { rotulo, dica, opcoes, aoEscolher }) {
    const id = `cb${++seqCampo}`;
    const lab = el('label'); lab.htmlFor = id; lab.textContent = rotulo;
    const caixa = el('div', 'combo');
    const inp = el('input'); inp.id = id; inp.type = 'text'; inp.placeholder = dica;
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list');
    inp.setAttribute('aria-expanded', 'false'); inp.setAttribute('aria-controls', `${id}-lista`);
    const limpar = el('button', 'combo__limpar', '×'); limpar.type = 'button'; limpar.setAttribute('aria-label', `Limpar ${rotulo}`); limpar.hidden = true;
    const lista = el('ul'); lista.id = `${id}-lista`; lista.setAttribute('role', 'listbox'); lista.hidden = true;
    const escolha = el('p', 'escolha');
    caixa.append(inp, limpar, lista);
    destino.append(lab, caixa, escolha);

    let visiveis = [], ativo = -1, atual = null;
    const marcar = i => {
      ativo = i;
      lista.querySelectorAll('[role=option]').forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      const li = lista.querySelector(`#${id}-o${i}`);
      if (li) { inp.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    };
    const fechar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); };
    const abrir = () => {
      visiveis = C.filtrar(opcoes, atual && inp.value === atual.rotulo ? '' : inp.value);
      lista.replaceChildren();
      let grupo = null;
      visiveis.slice(0, MAX_LISTA).forEach((o, i) => {
        if (o.grupo && o.grupo !== grupo) { grupo = o.grupo; const g = el('li', 'grupo', grupo); g.setAttribute('role', 'presentation'); lista.append(g); }
        const li = el('li'); li.id = `${id}-o${i}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        li.append(el('span', 'rot', o.rotulo), el('code', null, o.codigo));
        if (o.detalhe) li.append(el('span', 'det', o.detalhe));
        li.addEventListener('mousedown', ev => { ev.preventDefault(); escolher(o); });
        lista.append(li);
      });
      if (!visiveis.length) lista.append(el('li', 'nada', 'Nada encontrado. Tente outra palavra.'));
      else if (visiveis.length > MAX_LISTA) lista.append(el('li', 'nada', `Mais ${visiveis.length - MAX_LISTA} resultados: escreva mais uma palavra para filtrar.`));
      lista.hidden = false; inp.setAttribute('aria-expanded', 'true'); ativo = -1;
    };
    function escolher(o, silencioso) {
      atual = o;
      inp.value = o ? o.rotulo : '';
      limpar.hidden = !o;
      escolha.replaceChildren();
      if (o) { escolha.append('Código: '); escolha.append(el('b', null, o.codigo)); if (o.detalhe) escolha.append(` · ${o.detalhe}`); }
      fechar();
      if (!silencioso) aoEscolher(o ? o.valor : null);
    }
    inp.addEventListener('focus', abrir);
    inp.addEventListener('input', () => { if (atual) { atual = null; limpar.hidden = true; escolha.replaceChildren(); aoEscolher(null); } abrir(); });
    inp.addEventListener('blur', fechar);
    inp.addEventListener('keydown', ev => {
      const n = Math.min(visiveis.length, MAX_LISTA);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (lista.hidden) abrir(); marcar(Math.min(ativo + 1, n - 1)); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar(Math.max(ativo - 1, 0)); }
      else if (ev.key === 'Enter' && !lista.hidden && ativo >= 0) { ev.preventDefault(); escolher(visiveis[ativo]); }
      else if (ev.key === 'Escape') fechar();
    });
    limpar.addEventListener('click', () => { escolher(null); inp.focus(); });
    return { limpar: () => escolher(null, true), definir: v => escolher(opcoes.find(o => o.valor === v) || null) };
  }

  /* ---------- opções em texto amigável ---------- */
  const kmTexto = t => t.kmIni == null ? 'localização a definir' : `${t.rodovia} km ${C.fmtKm(t.kmIni)}${t.kmFim != null ? ` a ${C.fmtKm(t.kmFim)}` : ''}`;
  const opTramos = D.tramos.map(t => ({
    valor: t, codigo: t.id, grupo: `${t.zona} ${zonaPorId[t.zona]?.nome || ''}`,
    rotulo: `${t.desc}${t.subtipo ? ` (${t.subtipo})` : ''}`,
    detalhe: `${t.segNome ? `${t.segNome} · ` : ''}${kmTexto(t)}`,
    sinonimos: `${t.obraNome} ${t.obra} ${t.tramo} ${t.pasta || ''} ${zonaPorId[t.zona]?.titulo || ''}`,
  }));
  const opFases = D.fases.map(f => ({ valor: f, rotulo: f.nome, detalhe: f.ajuda, codigo: f.obra ? `${f.obra} + ${f.proj}` : f.proj }));
  const opDisc = D.disciplinas.map(d => ({ valor: d, rotulo: d.nome, codigo: d.cod, grupo: d.grupo, sinonimos: d.sinonimos }));
  const opCat = D.categorias.map(c => ({ valor: c, rotulo: c.nome, detalhe: c.ajuda, codigo: c.cod }));
  const opObras = D.tiposObra.map(o => ({ valor: o.cod, rotulo: o.nome, codigo: o.cod }));

  const campos = {
    tramo: criarCampo($('campo-tramo'), { rotulo: 'Obra ou trecho', dica: 'Digite o nome da obra, cidade ou km (ex.: duplicação Tucano)', opcoes: opTramos,
      aoEscolher: v => { estado.tramo = v; ajustarManual(); atualizar(); } }),
    fase: criarCampo($('campo-fase'), { rotulo: 'Fase ou tipo de serviço', dica: 'ex.: executivo, anteprojeto, as built, inspeção', opcoes: opFases,
      aoEscolher: v => { estado.fase = v; atualizar(); } }),
    disc: criarCampo($('campo-disc'), { rotulo: 'Disciplina', dica: 'ex.: drenagem, geometria, estrutura, sinalização', opcoes: opDisc,
      aoEscolher: v => { estado.disc = v; atualizar(); } }),
    cat: criarCampo($('campo-cat'), { rotulo: 'Tipo de documento', dica: 'ex.: prancha, memorial, modelo, relatório', opcoes: opCat,
      aoEscolher: v => { estado.cat = v; atualizar(); } }),
    obra: criarCampo($('campo-obra'), { rotulo: 'Tipo de obra', dica: 'ex.: duplicação, acesso, ponte, base operacional', opcoes: opObras,
      aoEscolher: v => { estado.obraManual = v; atualizar(); } }),
  };

  D.rodovias.forEach(r => { const o = el('option', null, r.nome); o.value = r.nome; $('m-rodovia').append(o); });
  $('lnk-central').href = D.centralBim;
  $('rodape-fontes').textContent = `Fontes: ${D.fontes}. Dados gerados em ${D.geradoEm.split('-').reverse().join('/')}.`;

  /* ---------- local informado à mão ---------- */
  const semLocal = t => t && (t.rodCod == null || t.kmIni == null);
  function ajustarManual() {
    const precisa = estado.manual || semLocal(estado.tramo);
    $('manual').hidden = !precisa;
    $('btn-manual').setAttribute('aria-expanded', String(estado.manual));
    $('btn-manual').textContent = estado.manual ? 'Voltar para a lista de obras' : 'A obra não está na lista? Informe o local';
    $('campo-obra').hidden = !estado.manual;
    $('manual-motivo').textContent = semLocal(estado.tramo)
      ? 'Esta obra ainda não tem km no PER (localização a definir). Informe rodovia e km do PER vigente; deixe o km final vazio para um ponto.'
      : 'Use o km do PER vigente. Deixe o km final vazio para um ponto (obra pontual).';
  }
  $('btn-manual').addEventListener('click', () => {
    estado.manual = !estado.manual;
    if (estado.manual) { estado.tramo = null; campos.tramo.limpar(); }
    ajustarManual(); atualizar();
  });
  ['m-rodovia', 'm-kmini', 'm-kmfim', 'seq', 'rev'].forEach(i => $(i).addEventListener('input', atualizar));

  const lerKm = v => { const s = String(v || '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) && n >= 0 && n < 1000 ? n : NaN; };

  /** Onde a obra está: rodovia, bloco 3, tipo de obra, zona, segmento, tramo e biblioteca. */
  function localizacao(faltam, avisos) {
    const t = estado.tramo;
    if (t && !semLocal(t)) {
      return { rodNome: t.rodovia, rod: t.rodCod, kmIni: t.kmIni, kmFim: t.kmFim, snv: snvTexto(t.snv), obra: t.obra, zona: t.zona, pasta: t.pasta, tramo: t.tramo, lib: t.lib, t };
    }
    if (!t && !estado.manual) { faltam.push('Escolha a obra (passo 1).'); return null; }
    const rodNome = $('m-rodovia').value;
    const kmIni = lerKm($('m-kmini').value), kmFim = lerKm($('m-kmfim').value);
    const obra = t ? t.obra : estado.obraManual;
    if (kmIni == null) faltam.push('Informe o km inicial (passo 1).');
    if (!obra) faltam.push('Escolha o tipo de obra (passo 1).');
    if (Number.isNaN(kmIni) || Number.isNaN(kmFim)) { avisos.push('km inválido: use número entre 0 e 999,999, com vírgula.'); return null; }
    if (kmIni == null || !obra) return null;
    if (kmFim != null && kmFim <= kmIni) { avisos.push('O km final precisa ser maior que o inicial. Para um ponto, deixe o km final vazio.'); return null; }
    const rod = D.rodovias.find(r => r.nome === rodNome).cod;
    if (t) return { rodNome, rod, kmIni, kmFim, snv: null, obra, zona: t.zona, pasta: t.pasta, tramo: t.tramo, lib: t.lib, t };
    const seg = C.localizarSegmento(D, rodNome, kmIni);
    const zona = seg ? seg.zona : (D.zonas.find(z => z.rodovia === rodNome && kmIni >= z.kmIni && kmIni <= z.kmFim) || {}).id || 'Z00';
    avisos.push(seg
      ? 'Obra fora da lista mestre: a pasta do tramo ainda não existe. Peça à Gestão da Informação o código do tramo antes de criar a pasta.'
      : 'Este km não cai em nenhum segmento do acervo. Confirme a zona com a Gestão da Informação.');
    return { rodNome, rod, kmIni, kmFim, snv: null, obra, zona, pasta: seg ? seg.pasta : null, tramo: null, lib: OBRAS_EDIF.has(obra) ? 'CDEEDIF' : 'CDEINFR', t: null };
  }

  /* ---------- montagem e saída ---------- */
  function atualizar() {
    const faltam = [], avisos = [];
    const loc = localizacao(faltam, avisos);
    if (!estado.fase) faltam.push('Escolha a fase (passo 2).');
    if (!estado.disc) faltam.push('Escolha a disciplina (passo 3).');
    if (!estado.cat) faltam.push('Escolha o tipo de documento (passo 4).');
    marcarPassos(loc);
    $('btn-seg').hidden = !(estado.cat && estado.cat.cod === 'MOD' && loc && loc.pasta && /-S\d{2}\b/.test(loc.pasta));

    estado.pastaAtual = loc ? loc.pasta : null;
    const pronto = loc && estado.fase && estado.disc && estado.cat;
    $('res').hidden = !pronto;
    $('res-vazio').hidden = !!pronto;
    $('faltam').replaceChildren(...faltam.map(f => el('li', null, f)), ...(pronto ? [] : avisos.map(a => el('li', null, a))));
    if (!pronto) return;

    const obra = estado.fase.obra || loc.obra;
    if (estado.fase.obra === 'OAE' && loc.obra !== 'OAE') avisos.push('Diretriz de recuperação de OAE: confira se a obra escolhida é uma OAE.');
    const r = C.montar({ rod: loc.rod, local: C.blocoLocal(loc.kmIni, loc.kmFim), obra, proj: estado.fase.proj,
      cat: estado.cat, disc: estado.disc, seq: $('seq').value, rev: $('rev').value });
    if (!estado.disc.libs.includes(loc.lib)) avisos.push(`A disciplina ${estado.disc.cod} não tem pasta modelo em ${C.BIBLIOTECAS[loc.lib]}. Confirme com a Gestão da Informação onde salvar.`);
    const cam = C.caminho({ site: zonaPorId[loc.zona].site, lib: loc.lib, pasta: loc.pasta, tramo: loc.tramo, fase: estado.fase.proj, ddd: estado.disc.cod, ttt: estado.cat.cod });

    $('out-ccs').textContent = r.ccs || 'Corrija o número ou a revisão (passo 5).';
    $('out-ccs').classList.toggle('pendente', !r.ccs);
    $('out-antt').textContent = r.antt || 'Sem nome de protocolo para esta combinação (veja os avisos).';
    $('out-antt').classList.toggle('pendente', !r.antt);
    $('btn-antt').setAttribute('aria-disabled', String(!r.antt));
    $('out-ident').textContent = r.ident;
    $('avisos').replaceChildren(...[...r.avisos, ...avisos].map(a => el('li', null, a)));

    $('out-trilha').replaceChildren(...cam.niveis.map((n, i) => el('li', i < cam.existe ? null : 'criar', n)));
    const faltaCriar = cam.niveis.length - cam.existe;
    $('out-trilha-nota').textContent = `Site ${zonaPorId[loc.zona].titulo}. ` + (faltaCriar
      ? `As ${faltaCriar} pasta(s) tracejada(s) ainda não existem: copie a estrutura de _MODELO_TRAMO da mesma biblioteca para dentro do tramo.`
      : 'Todas as pastas já existem.');
    $('out-abrir').href = cam.url;
    $('out-caminho').textContent = `${cam.site}/${cam.niveis.join('/')}`;

    const local = `${loc.rodNome} km ${C.fmtKm(loc.kmIni)}${loc.kmFim != null ? ` a ${C.fmtKm(loc.kmFim)}` : ''} PER`;
    $('out-local').textContent = loc.snv ? `${local} / ${loc.snv} SNV (DNIT 202607A)` : `${local} / km SNV: converta pelo conversor PER × SNV 202607A antes de preencher os metadados.`;
    preencherMeta(loc, obra, r);
  }

  function preencherMeta(loc, obra, r) {
    const t = loc.t, z = zonaPorId[loc.zona], s = loc.pasta ? segPorPasta[loc.pasta] : null;
    const cat = siglaPrimeira(estado.cat.antt), disc = siglaPrimeira(estado.disc.antt);
    const linhas = [
      ['Zona', `${z.id} ${z.nome}`],
      ['Segmento', s ? `${s.pasta} (${s.nome})` : 'não definido'],
      ['Tramo', loc.tramo || 'a definir com a Gestão da Informação'],
      ['Rodovia/UF', loc.rodNome],
      ['km PER (inicial e final)', `${C.fmtKm(loc.kmIni)}${loc.kmFim != null ? ` a ${C.fmtKm(loc.kmFim)}` : ''}`],
      ['km SNV DNIT 202607A', loc.snv || 'converter'],
      ['Trecho SNV', t?.trechoSnv || 'não informado'],
      ['Trecho homogêneo (TH)', t?.th || s?.th || 'não informado'],
      ['Ano de obra (PER)', t?.anoObra || 'não informado'],
      ['Ano de projeto', t?.anoProjeto || 'não informado'],
      ['Tipo de obra', `${obra} ${obraNome[obra] || ''}`],
      ['Tipo de projeto', `${estado.fase.proj} ${estado.fase.nome}`],
      ['Categoria CCS', `${estado.cat.cod} ${estado.cat.nome}`],
      ['Disciplina CCS', `${estado.disc.cod} ${estado.disc.nome}`],
      ['Classe ANTT', cat || 'sem classe ANTT'],
      ['Disciplina ANTT', disc || 'sem disciplina ANTT'],
      ['Código ANTT', r.ident],
      ['Revisão', C.normRev($('rev').value) || 'não informado'],
    ];
    $('out-meta').replaceChildren(...linhas.map(([k, v]) => { const tr = el('tr'); tr.append(el('th', null, k), el('td', null, v)); return tr; }));
  }
  const siglaPrimeira = v => (/GEENG|^n\/a/i.test(String(v)) ? null : String(v).split('/')[0].trim());

  function marcarPassos(loc) {
    const feitos = [!!loc, !!estado.fase, !!estado.disc, !!estado.cat, !!(C.normSeq($('seq').value) && C.normRev($('rev').value))];
    document.querySelectorAll('.passo').forEach((p, i) => p.classList.toggle('feito', feitos[i]));
  }

  /* ---------- ações ---------- */
  $('btn-seg').addEventListener('click', () => {
    const m = estado.pastaAtual && estado.pastaAtual.match(/-S(\d{2})\b/);
    if (m) { $('seq').value = `S${m[1]}`; atualizar(); }
  });
  document.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    const txt = $(b.dataset.copiar).textContent;
    const original = b.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copiado'; }
    catch (e) { b.textContent = 'Não copiou: selecione e use Ctrl+C'; }
    setTimeout(() => { b.textContent = original; }, 1600);
  }));
  $('form').addEventListener('reset', () => {
    Object.assign(estado, { tramo: null, manual: false, obraManual: null, fase: null, disc: null, cat: null });
    Object.values(campos).forEach(c => c.limpar());
    setTimeout(() => { ajustarManual(); atualizar(); }, 0);
  });

  ajustarManual();
  atualizar();
})();
