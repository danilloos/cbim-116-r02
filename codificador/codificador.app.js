/* Interface do Codificador de Projetos 116 Sertões. Regras em codificador.core.js; dados em dados.js (gerar_codificador.py). */
(function () {
  'use strict';
  const D = window.CCS_DADOS;
  const C = window.CCSCore;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const MAX_LISTA = 80;

  const zonaPorId = Object.fromEntries(D.zonas.map(z => [z.id, z]));
  const thPorPasta = Object.fromEntries(D.ths.filter(s => s.pasta).map(s => [s.pasta, s]));
  const obraNome = Object.fromEntries(D.tiposObra.map(o => [o.cod, o.nome]));
  const OBRAS_EDIF = new Set(D.obrigacoes.filter(t => t.lib === 'CDEEDIF').map(t => t.obra));

  const estado = { zona: null, thPasta: null, obr: null, manual: false, obraManual: null, fase: null, disc: null, cat: null };

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

    let visiveis = [], ativo = -1, atual = null, ops = opcoes;
    const marcar = i => {
      ativo = i;
      lista.querySelectorAll('[role=option]').forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      const li = lista.querySelector(`#${id}-o${i}`);
      if (li) { inp.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    };
    const fechar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); };
    const abrir = () => {
      visiveis = C.filtrar(ops, atual && inp.value === atual.rotulo ? '' : inp.value);
      lista.replaceChildren();
      inp.removeAttribute('aria-activedescendant');
      let grupo = null;
      visiveis.slice(0, MAX_LISTA).forEach((o, i) => {
        if (o.grupo && o.grupo !== grupo) { grupo = o.grupo; const g = el('li', 'grupo', grupo); g.setAttribute('role', 'presentation'); lista.append(g); }
        const li = el('li'); li.id = `${id}-o${i}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        li.append(el('span', 'rot', o.rotulo), el('code', null, o.codigo));
        if (o.detalhe) li.append(el('span', 'det', o.detalhe));
        li.addEventListener('mousedown', ev => { ev.preventDefault(); escolher(o); });
        lista.append(li);
      });
      const aviso = txt => { const li = el('li', 'nada', txt); li.setAttribute('role', 'option'); li.setAttribute('aria-disabled', 'true'); lista.append(li); };
      if (!visiveis.length) aviso('Nada encontrado. Tente outra palavra.');
      else if (visiveis.length > MAX_LISTA) aviso(`Mais ${visiveis.length - MAX_LISTA} resultados: escreva mais uma palavra para filtrar.`);
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
    return { limpar: () => escolher(null, true), definir: v => escolher(ops.find(o => o.valor === v) || null),
             trocar: novas => { ops = novas; escolher(null, true); } };
  }

  /* ---------- opções em texto amigável ---------- */
  const kmTexto = t => t.kmIni == null ? 'localização a definir' : `${t.rodovia} km SNV ${C.fmtKm(t.kmIni)}${t.kmFim != null ? ` a ${C.fmtKm(t.kmFim)}` : ''}`;
  const opObr = D.obrigacoes.map(t => ({
    valor: t, codigo: t.id, grupo: t.obraNome,
    rotulo: `${t.desc}${t.subtipo ? ` (${t.subtipo})` : ''}`,
    detalhe: `${t.pasta ? `${t.pasta} · ` : ''}${kmTexto(t)}${t.parteKm ? ` · parte km SNV ${C.fmtKm(t.parteKm[0])} a ${C.fmtKm(t.parteKm[1])}` : ''}`,
    sinonimos: `${t.obraNome} ${t.obra} ${t.id} ${t.th || ''} ${t.pasta || ''} ${zonaPorId[t.zona]?.titulo || ''}`,
  }));
  const opFases = D.fases.map(f => ({ valor: f, rotulo: f.nome, detalhe: f.ajuda, codigo: f.obra ? `${f.obra} + ${f.proj}` : f.proj }));
  const opDisc = D.disciplinas.map(d => ({ valor: d, rotulo: d.nome, codigo: d.cod, grupo: d.grupo, sinonimos: d.sinonimos }));
  const opCat = D.categorias.map(c => ({ valor: c, rotulo: c.nome, detalhe: c.ajuda, codigo: c.cod }));
  const opObras = D.tiposObra.map(o => ({ valor: o.cod, rotulo: o.nome, codigo: o.cod }));

  const campos = {
    obr: criarCampo($('campo-obr'), { rotulo: 'Obrigação do PER no TH', dica: 'ex.: duplicação, passarela, retorno, km', opcoes: [],
      aoEscolher: v => { estado.obr = v; if (v) estado.manual = false; limparManual(); ajustarManual(); atualizar(); } }),
    fase: criarCampo($('campo-fase'), { rotulo: 'Fase ou tipo de serviço', dica: 'ex.: executivo, anteprojeto, as built, inspeção', opcoes: opFases,
      aoEscolher: v => { estado.fase = v; atualizar(); } }),
    disc: criarCampo($('campo-disc'), { rotulo: 'Disciplina', dica: 'ex.: drenagem, geometria, estrutura, sinalização', opcoes: opDisc,
      aoEscolher: v => { estado.disc = v; atualizar(); } }),
    cat: criarCampo($('campo-cat'), { rotulo: 'Tipo de documento', dica: 'ex.: prancha, memorial, modelo, relatório', opcoes: opCat,
      aoEscolher: v => { estado.cat = v; atualizar(); } }),
    obra: criarCampo($('campo-obra'), { rotulo: 'Tipo de obra', dica: 'ex.: duplicação, acesso, ponte, base operacional', opcoes: opObras,
      aoEscolher: v => { estado.obraManual = v; atualizar(); } }),
  };

  /* ---------- cascata: zona (botões) -> TH (menu) -> obrigação ---------- */
  D.zonas.forEach(z => {
    const lab = el('label', 'zona');
    const r = el('input'); r.type = 'radio'; r.name = 'zona'; r.value = z.id;
    lab.append(r, el('b', null, z.id), el('small', null, z.titulo.replace(z.id, '').trim() || z.nome));
    lab.title = z.nome;
    r.addEventListener('change', () => escolherZona(z.id));
    $('zonas').append(lab);
  });
  function escolherZona(id) {
    estado.zona = id; estado.thPasta = null; estado.obr = null;
    const sel = $('sel-th');
    sel.replaceChildren(Object.assign(el('option', null, id ? 'Escolha o TH' : 'Escolha a zona primeiro'), { value: '' }));
    for (const t of id ? C.thsDaZona(D.obrigacoes, id, D.ths) : []) {
      const info = D.ths.find(x => x.th === t.th);
      sel.append(Object.assign(el('option', null, t.pasta === 'EDIF' ? `EDIF · edificações da zona (${t.n})`
        : `${t.pasta} · ${t.th}${C.faixaSnv(info)} (${t.n} obrigação${t.n > 1 ? 'ões' : ''})`), { value: t.pasta }));
    }
    sel.disabled = !id;
    escolherTH('');
  }
  function escolherTH(pasta) {
    estado.thPasta = pasta || null; estado.obr = null;
    // agrupadas por tipo de obra (ordenação estável: dentro do tipo, segue a ordem de km da lista mestre)
    const ops = pasta ? opObr.filter(o => o.valor.zona === estado.zona && o.valor.pasta === pasta).sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt')) : [];
    campos.obr.trocar(ops);
    $('campo-obr').hidden = ops.length < 2;  // TH com uma obrigação só: ela já vem escolhida
    if (ops.length === 1) campos.obr.definir(ops[0].valor);
    else { limparManual(); ajustarManual(); atualizar(); }
  }
  $('sel-th').addEventListener('change', ev => escolherTH(ev.target.value));

  { const vazio = el('option', null, 'Escolha a rodovia'); vazio.value = ''; $('m-rodovia').append(vazio); }
  D.rodovias.forEach(r => { const o = el('option', null, r.nome); o.value = r.nome; $('m-rodovia').append(o); });
  $('lnk-central').href = D.centralBim;
  $('lnk-codigos').href = D.listaCodigos;
  const dataBr = iso => iso.split('-').reverse().join('/');
  $('rodape-fontes').textContent = `Fontes: ${D.fontes}. Tabelas exportadas da Central BIM em ${dataBr(D.exportadoEm)}; dados gerados em ${dataBr(D.geradoEm)}.`;

  /* ---------- local informado à mão ---------- */
  const semLocal = t => t && (t.rodCod == null || t.kmIni == null);
  function limparManual() {
    $('m-kmini').value = ''; $('m-kmfim').value = ''; $('m-rodovia').selectedIndex = 0;
  }
  function ajustarManual() {
    const precisa = estado.manual || semLocal(estado.obr);
    $('manual').hidden = !precisa;
    $('btn-manual').setAttribute('aria-expanded', String(precisa));
    $('btn-manual').textContent = estado.manual ? 'Voltar para a lista de obras' : 'A obra não está na lista? Informe o local';
    $('cascata').hidden = estado.manual;
    $('campo-obra').hidden = !estado.manual;
    const t = estado.obr;
    let motivo = 'Use o km SNV 202607A. Deixe o km final vazio para um ponto (obra pontual).';
    if (semLocal(t) && t.kmIni == null) motivo = 'Esta obra ainda não tem km no PER (localização a definir). Informe rodovia e km SNV 202607A; deixe o km final vazio para um ponto.';
    else if (semLocal(t)) {
      motivo = `A lista mestre não define o código de rodovia para "${t.rodovia}". Escolha a rodovia do código ANTT; o km já veio da lista mestre.`;
      $('m-kmini').value = C.fmtKm(t.kmIni);
      $('m-kmfim').value = t.kmFim != null ? C.fmtKm(t.kmFim) : '';
    }
    $('manual-motivo').textContent = motivo;
  }
  $('btn-manual').addEventListener('click', () => {
    estado.manual = !estado.manual;
    if (estado.manual) { document.querySelectorAll('input[name=zona]').forEach(r => { r.checked = false; }); escolherZona(null); }
    limparManual();
    ajustarManual(); atualizar();
  });
  ['m-rodovia', 'm-kmini', 'm-kmfim', 'seq', 'rev'].forEach(i => $(i).addEventListener('input', atualizar));

  const lerKm = C.lerKm;

  /** Onde a obra está: rodovia, bloco 3, tipo de obra, zona, TH, obrigação e biblioteca. */
  function localizacao(faltam, avisos) {
    const t = estado.obr;
    if (t && !semLocal(t)) {
      return { rodNome: t.rodovia, rod: t.rodCod, kmIni: t.kmIni, kmFim: t.kmFim, per: t.kmPer, obra: t.obra, zona: t.zona, pasta: t.pasta, obrigacao: t.id, lib: t.lib, t };
    }
    if (!t && !estado.manual) {
      faltam.push(!estado.zona ? 'Escolha a zona (passo 1).' : !estado.thPasta ? 'Escolha o TH (passo 1).' : 'Escolha a obrigação do TH (passo 1).');
      return null;
    }
    const rodNome = $('m-rodovia').value;
    const kmIni = lerKm($('m-kmini').value), kmFim = lerKm($('m-kmfim').value);
    const obra = t ? t.obra : estado.obraManual;
    if (!rodNome) faltam.push('Escolha a rodovia (passo 1).');
    if (kmIni == null) faltam.push('Informe o km inicial (passo 1).');
    if (!obra) faltam.push('Escolha o tipo de obra (passo 1).');
    if (Number.isNaN(kmIni) || Number.isNaN(kmFim)) { avisos.push('km inválido: use até três casas decimais, com vírgula (ex.: 288,350).'); return null; }
    if (kmIni == null || !obra || !rodNome) return null;
    if (kmFim != null && kmFim === kmIni) { avisos.push('O km final é igual ao inicial. Para um ponto, deixe o km final vazio.'); return null; }  // menor vale: BR-324 tem SNV decrescente
    const rod = D.rodovias.find(r => r.nome === rodNome).cod;
    if (t) return { rodNome, rod, kmIni, kmFim, per: null, obra, zona: t.zona, pasta: t.pasta, obrigacao: t.id, lib: t.lib, t };
    const th = C.localizarTH(D, rodNome, kmIni);
    const zona = th ? th.zona : 'Z00';  // km fora de qualquer TH: aviso abaixo, zona a confirmar
    avisos.push(!th
      ? 'Este km não cai em nenhum TH do acervo. Confirme a zona com a Gestão da Informação.'
      : th.pasta
        ? 'Obra fora da lista mestre: a pasta da obrigação ainda não existe. Peça à Gestão da Informação o código da obrigação antes de criar a pasta.'
        : `O ${th.th} não tem pasta Ano-TH no acervo (sem obra de projeto ou só com edificação). Peça à Gestão da Informação a pasta e o código da obrigação antes de salvar.`);
    return { rodNome, rod, kmIni, kmFim, per: null, obra, zona, pasta: th ? th.pasta : null, obrigacao: null, lib: OBRAS_EDIF.has(obra) ? 'CDEEDIF' : 'CDEINFR', t: null };
  }

  /* ---------- montagem e saída ---------- */
  function atualizar() {
    const faltam = [], avisos = [];
    const loc = localizacao(faltam, avisos);
    if (!estado.fase) faltam.push('Escolha a fase (passo 2).');
    if (!estado.disc) faltam.push('Escolha a disciplina (passo 3).');
    if (!estado.cat) faltam.push('Escolha o tipo de documento (passo 4).');
    marcarPassos(loc);

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
    const cam = C.caminho({ site: zonaPorId[loc.zona].site, lib: loc.lib, pasta: loc.pasta, obrigacao: loc.obrigacao, fase: estado.fase.proj, ddd: estado.disc.cod, ttt: estado.cat.cod });

    $('out-ccs').textContent = r.ccs || 'Corrija o número ou a revisão (passo 5).';
    $('out-ccs').classList.toggle('pendente', !r.ccs);
    $('out-antt').textContent = r.antt || 'Sem nome de protocolo para esta combinação (veja os avisos).';
    $('out-antt').classList.toggle('pendente', !r.antt);
    $('btn-antt').disabled = !r.antt;
    $('btn-ccs').disabled = !r.ccs;
    $('out-ident').textContent = r.ident;
    $('status').textContent = r.ccs ? `Código pronto: ${r.ccs}` : 'Código incompleto: confira o número e a revisão.';
    $('avisos').replaceChildren(...[...r.avisos, ...avisos].map(a => el('li', null, a)));

    $('out-trilha').replaceChildren(...cam.niveis.map((n, i) => el('li', i < cam.existe ? null : 'criar', n)));
    const faltaCriar = cam.niveis.length - cam.existe;
    const semTH = loc.obrigacao && !loc.pasta;
    $('out-trilha-nota').textContent = `Site ${zonaPorId[loc.zona].titulo}. ` + (semTH
      ? 'Esta obra ainda não tem pasta Ano-TH no site. Combine com a Gestão da Informação onde criar a pasta da obrigação antes de salvar.'
      : faltaCriar
        ? `As ${faltaCriar} pasta(s) tracejada(s) ainda não existem: copie a estrutura de _MODELO_OBRIGACAO da mesma biblioteca para dentro da pasta da obrigação.`
        : 'Todas as pastas já existem.');
    $('out-abrir').href = cam.url;
    $('out-caminho').textContent = cam.texto;

    const local = `${loc.rodNome} km ${C.fmtKm(loc.kmIni)}${loc.kmFim != null ? ` a ${C.fmtKm(loc.kmFim)}` : ''} SNV (DNIT 202607A)`;
    $('out-local').textContent = loc.per ? `${local} / km PER ${C.fmtKm(loc.per[0])}${loc.per[1] != null ? ` a ${C.fmtKm(loc.per[1])}` : ''} (provisório)` : `${local} / km PER: correlação provisória, consulte a lista mestre.`;
    preencherMeta(loc, obra, r);
  }

  function preencherMeta(loc, obra, r) {
    const t = loc.t, z = zonaPorId[loc.zona], s = loc.pasta ? thPorPasta[loc.pasta] : null;
    const cat = siglaPrimeira(estado.cat.antt), disc = siglaPrimeira(estado.disc.antt);
    const linhas = [
      ['Zona', `${z.id} ${z.nome}`],
      ['Pasta Ano-TH', s ? `${s.pasta} (${s.th})` : 'não definido'],
      ['Obrigação', t ? `${t.id} · ${t.desc}` : 'a definir com a Gestão da Informação'],
      ...(t && t.parteKm ? [['Parte da obrigação', `${t.id}: km SNV ${C.fmtKm(t.parteKm[0])} a ${C.fmtKm(t.parteKm[1])} (o código usa o km da obrigação inteira)`]] : []),
      ['Rodovia/UF', loc.rodNome],
      ['km SNV DNIT 202607A (inicial e final)', `${C.fmtKm(loc.kmIni)}${loc.kmFim != null ? ` a ${C.fmtKm(loc.kmFim)}` : ''}`],
      ['km PER (provisório)', loc.per ? `${C.fmtKm(loc.per[0])}${loc.per[1] != null ? ` a ${C.fmtKm(loc.per[1])}` : ''}` : 'consultar a lista mestre'],
      ['Trecho SNV', t?.trechoSnv || 'não informado'],
      ['Trecho homogêneo (TH)', (t && t.th !== 'SEM-TH' && t.th) || s?.th || 'não informado'],
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
  document.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    const alvo = $(b.dataset.copiar);
    if (b.disabled || alvo.classList.contains('pendente')) return;  // nunca copia mensagem no lugar de código
    const txt = alvo.textContent;
    const original = b.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copiado'; }
    catch (e) {
      // dentro do iframe da Central BIM a API pode ser bloqueada (o SharePoint remove allow="clipboard-write")
      const area = el('textarea'); area.value = txt; area.setAttribute('readonly', ''); area.className = 'oculto';
      document.body.append(area); area.select();
      const ok = document.execCommand('copy');
      area.remove();
      b.textContent = ok ? 'Copiado' : 'Não copiou: selecione e use Ctrl+C';
    }
    setTimeout(() => { b.textContent = original; }, 1600);
  }));
  $('form').addEventListener('reset', () => {
    Object.assign(estado, { zona: null, thPasta: null, obr: null, manual: false, obraManual: null, fase: null, disc: null, cat: null });
    Object.values(campos).forEach(c => c.limpar());
    setTimeout(() => { escolherZona(null); ajustarManual(); }, 0);
  });

  ajustarManual();
  atualizar();
})();
