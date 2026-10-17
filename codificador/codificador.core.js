/* Núcleo do Codificador de Projetos 116 Sertões: regras de código e de pasta, sem DOM.
   Fonte das regras: Caderno BIM 116 Sertões, Volume II, Seções 6.4 e 6.7, e Anexo A.3 (Portaria SUROD 12/2025, Anexo 1.1).
   Usado no navegador (window.CCSCore) e nos testes (node --test codificador.test.cjs). */
(function (raiz) {
  'use strict';

  const CONCESSIONARIA = 'CCS';
  const ORIGEM = 'https://novainfrainvest.sharepoint.com';
  const BIBLIOTECAS = { CDEINFR: '02 CDE-INFR', CDEEDIF: '03 CDE-EDIF' };
  const FASES_COM_PASTA = new Set(['ANT', 'EXO']);           // criadas em cada obrigação (gerar_config_zonas.py)
  const CATEGORIAS_COM_PASTA = new Set(['PRC', 'MEM', 'MOD', 'PLQ']); // nível 5, só no EXO (_MODELO_OBRIGACAO)
  const SEM_TH = '(TH a definir)';

  const pad = (n, w) => String(n).padStart(w, '0');

  /** Bloco 3 (localização, km SNV 202607A). Trecho: km truncados, e se caírem no mesmo km o final soma 1.
      Pontual: km+metros. Metros inteiros evitam erro de ponto flutuante (26,15 -> 026+150). */
  function blocoLocal(kmIni, kmFim) {
    if (kmFim !== null && kmFim !== undefined && kmFim !== '' && Number(kmFim) < Number(kmIni)) [kmIni, kmFim] = [kmFim, kmIni];  // BR-324: SNV decrescente
    const mIni = Math.round(Number(kmIni) * 1000);
    if (kmFim === null || kmFim === undefined || kmFim === '') {
      return `${pad(Math.floor(mIni / 1000), 3)}+${pad(mIni % 1000, 3)}`;
    }
    const ini = Math.floor(mIni / 1000);
    let fim = Math.floor(Math.round(Number(kmFim) * 1000) / 1000);
    if (fim <= ini) fim = ini + 1;
    return `${pad(ini, 3)}-${pad(fim, 3)}`;
  }

  /** Identificador ANTT de 5 níveis (capas e protocolo). */
  function identificador({ rod, local, obra, proj }) {
    return [CONCESSIONARIA, rod, local, obra, proj].join('-');
  }

  /** Sequencial: 1 a 999 vira 001 a 999; H1 a H99 (modelo BIM: H + número do TH, decisão D2 de 16/10/2026) vira H01. */
  function normSeq(v) {
    const s = String(v ?? '').trim().toUpperCase();
    if (/^\d{1,3}$/.test(s) && Number(s) > 0) return pad(Number(s), 3);
    const m = s.match(/^H(\d{1,2})$/);
    return m && Number(m[1]) > 0 ? `H${pad(Number(m[1]), 2)}` : null;
  }

  /** Revisão: 0 a 99, com ou sem R. */
  function normRev(v) {
    const m = String(v ?? '').trim().toUpperCase().match(/^R?(\d{1,2})$/);
    return m ? `R${pad(Number(m[1]), 2)}` : null;
  }

  /** De-para para a sigla ANTT: devolve {sigla, aviso}. Sigla nula quando não há classe/disciplina ANTT. */
  function siglaAntt(valor, oque) {
    const v = String(valor || '').trim();
    if (/GEENG/i.test(v)) return { sigla: null, aviso: `A classe ANTT de ${oque} ainda será definida pela GEENG; por ora, o arquivo não recebe nome de protocolo.` };
    if (!v || /^n\/a/i.test(v)) return { sigla: null, aviso: `Esta ${oque} não tem sigla ANTT: o arquivo circula só no CDE e não vai a protocolo.` };
    const partes = v.split('/').map(s => s.trim()).filter(Boolean);
    const aviso = partes.length > 1 ? `Para a ${oque}, a ANTT aceita ${partes.join(' ou ')}; usei ${partes[0]}. Troque se o documento for do outro tipo.` : null;
    return { sigla: partes[0], aviso };
  }

  /** Monta os três códigos. cat/disc: {cod, antt}. */
  function montar({ rod, local, obra, proj, cat, disc, seq, rev }) {
    const avisos = [];
    const ident = identificador({ rod, local, obra, proj });
    const s = normSeq(seq);
    const r = normRev(rev);
    if (!s) avisos.push('Sequencial inválido: use um número de 1 a 999 (ou H + número do TH, como H20, para modelo BIM).');
    if (!r) avisos.push('Revisão inválida: use um número de 0 a 99 (R00 é a primeira emissão).');
    if (!s || !r) return { ident, ccs: null, antt: null, avisos };
    if (s.startsWith('H') && cat.cod !== 'MOD') avisos.push('Sequencial H + TH (H20) é só para modelo BIM; nos demais documentos use número.');
    const ccs = [ident, cat.cod, disc.cod, s, r].join('-');
    const c = siglaAntt(cat.antt, 'categoria');
    const d = siglaAntt(disc.antt, 'disciplina');
    let antt = null;
    if (c.sigla && d.sigla && !s.startsWith('H')) antt = [ident, c.sigla, d.sigla, s, r].join('-');
    for (const x of [c, d]) if (x.aviso) avisos.push(x.aviso);
    if (c.sigla && d.sigla && s.startsWith('H')) avisos.push('No nome ANTT o sequencial é numérico: informe o número do modelo para gerar o nome de protocolo.');
    return { ident, ccs, antt, avisos };
  }

  /** Caminho no SharePoint da zona. Devolve níveis, quantos já existem, o link da pasta existente mais funda
      e o caminho em texto (nomes exibidos, para o projetista conferir; não é URL). */
  function caminho({ site, lib, pasta, obrigacao, fase, ddd, ttt }) {
    const niveis = [BIBLIOTECAS[lib]];
    let existe = 1;
    if (pasta) { niveis.push(pasta); existe = 2; }
    else if (obrigacao) niveis.push(SEM_TH);  // obra fora da lista mestre, em km sem pasta Ano-TH
    if (obrigacao) {
      niveis.push(obrigacao);
      if (pasta) existe = 3;
      niveis.push(fase);
      if (pasta && FASES_COM_PASTA.has(fase)) existe = 4;
      niveis.push(ddd);
      if (fase === 'EXO' && CATEGORIAS_COM_PASTA.has(ttt)) niveis.push(ttt);
    }
    const rel = [`/sites/${site}/${lib}`, ...niveis.slice(1, existe)].join('/');
    const url = `${ORIGEM}/sites/${site}/${lib}/Forms/AllItems.aspx?id=${encodeURIComponent(rel)}`;
    return { niveis, existe, url, site: `${ORIGEM}/sites/${site}`, texto: [site, ...niveis].join(' / ') };
  }

  const normalizar = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /** Busca por palavras, sem acento nem caixa, em rótulo, código, grupo, sinônimos e detalhe.
      Quem tem todas as palavras no rótulo ou no código vem primeiro; dentro de cada faixa, a ordem original. */
  function filtrar(opcoes, termo) {
    const fichas = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!fichas.length) return opcoes.slice();
    const faixas = [[], []];
    for (const o of opcoes) {
      const palheiro = normalizar([o.rotulo, o.codigo, o.grupo, o.sinonimos, o.detalhe].join(' '));
      if (!fichas.every(f => palheiro.includes(f))) continue;
      const nome = normalizar(`${o.rotulo} ${o.codigo}`);
      faixas[fichas.every(f => nome.includes(f)) ? 0 : 1].push(o);
    }
    return faixas[0].concat(faixas[1]);
  }

  /** TH que contém o km na rodovia (local informado à mão). Intervalo semiaberto [início, fim):
      o km de fronteira fica no TH que começa nele; o fim do último TH da rodovia vale como dentro.
      O TH vem com `pasta` nula quando não tem obra de projeto (ou só edificação): não há pasta Ano-TH no CDE. */
  function localizarTH(dados, rodovia, km) {
    const k = Number(km);
    const daRodovia = dados.ths.filter(s => s.rodovia === rodovia);
    return daRodovia.find(s => k >= s.kmIni && k < s.kmFim)
      || daRodovia.find(s => k === s.kmFim && !daRodovia.some(o => o.kmIni === s.kmFim))
      || null;
  }

  /** km digitado: até 3 dígitos inteiros e 3 decimais, vírgula ou ponto. Vazio = null; inválido = NaN. */
  function lerKm(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    return /^\d{1,3}([.,]\d{1,3})?$/.test(s) ? Number(s.replace(',', '.')) : NaN;
  }

  const fmtKm = k => Number(k).toFixed(3).replace('.', ',');
  /** ' · km SNV a a b' do TH para o menu; vazio quando o TH não tem km SNV (Contorno de Serrinha, via nova). */
  const faixaSnv = t => (t && t.kmIni != null && t.kmFim != null ? ` · km SNV ${fmtKm(t.kmIni)} a ${fmtKm(t.kmFim)}` : '');
  /** Texto da lista mestre para exibir: travessão e meia-risca de intervalo viram "a" (DS 116: sem travessão). */
  const semTraco = t => String(t ?? '').replace(/\s*[–—]\s*/g, ' a ');

  /** TH de uma zona para o menu em cascata, na ordem de km SNV: um item por pasta (Ano-TH ou EDIF) com obrigações;
      n = linhas de obrigação na pasta. */
  function thsDaZona(obrigacoes, zona, ths) {
    const porPasta = new Map();
    for (const o of obrigacoes) {
      if (o.zona !== zona || !o.pasta) continue;
      const t = porPasta.get(o.pasta) || { pasta: o.pasta, th: o.pasta === 'EDIF' ? null : o.th, n: 0 };
      t.n++;
      porPasta.set(o.pasta, t);
    }
    const km = Object.fromEntries((ths || []).map(t => [t.th, t.kmIni ?? 0]));
    return [...porPasta.values()].sort((a, b) => (a.pasta === 'EDIF') - (b.pasta === 'EDIF') || (km[a.th] ?? 0) - (km[b.th] ?? 0));
  }

  /** Lê dados.js (window.CCS_DADOS = {...};) fora do navegador. */
  function lerDadosArquivo(arquivo) {
    const txt = require('fs').readFileSync(arquivo, 'utf8');
    return JSON.parse(txt.slice(txt.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  }

  const api = { CONCESSIONARIA, BIBLIOTECAS, blocoLocal, identificador, normSeq, normRev, montar, caminho,
                normalizar, filtrar, localizarTH, lerKm, fmtKm, faixaSnv, thsDaZona, semTraco, lerDadosArquivo, SEM_TH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CCSCore = api;
})(this);
