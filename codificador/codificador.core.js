/* Núcleo do Codificador de Projetos 116 Sertões: regras de código e de pasta, sem DOM.
   Fonte das regras: Caderno BIM 116 Sertões, Volume II, Seções 6.4 e 6.7, e Anexo A.3 (Portaria SUROD 12/2025, Anexo 1.1).
   Usado no navegador (window.CCSCore) e nos testes (node --test codificador.test.cjs). */
(function (raiz) {
  'use strict';

  const CONCESSIONARIA = 'CCS';
  const ORIGEM = 'https://novainfrainvest.sharepoint.com';
  const BIBLIOTECAS = { CDEINFR: '02 CDE-INFR', CDEEDIF: '03 CDE-EDIF' };
  const FASES_COM_PASTA = new Set(['ANT', 'EXO']);           // criadas em cada tramo (gerar_config_zonas.py)
  const CATEGORIAS_COM_PASTA = new Set(['PRC', 'MEM', 'MOD', 'PLQ']); // nível 5, só no EXO (_MODELO_TRAMO)
  const SEM_SEGMENTO = '(segmento a definir)';

  const pad = (n, w) => String(n).padStart(w, '0');

  /** Bloco 3 (localização, km do PER). Trecho: km truncados, e se caírem no mesmo km o final soma 1.
      Pontual: km+metros. Metros inteiros evitam erro de ponto flutuante (26,15 -> 026+150). */
  function blocoLocal(kmIni, kmFim) {
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

  /** Sequencial: 1 a 999 vira 001 a 999; S1 a S99 (segmento, só em modelo BIM) vira S01. */
  function normSeq(v) {
    const s = String(v ?? '').trim().toUpperCase();
    if (/^\d{1,3}$/.test(s) && Number(s) > 0) return pad(Number(s), 3);
    const m = s.match(/^S(\d{1,2})$/);
    return m && Number(m[1]) > 0 ? `S${pad(Number(m[1]), 2)}` : null;
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
    if (!s) avisos.push('Sequencial inválido: use um número de 1 a 999 (ou S01 a S99 para modelo BIM por segmento).');
    if (!r) avisos.push('Revisão inválida: use um número de 0 a 99 (R00 é a primeira emissão).');
    if (!s || !r) return { ident, ccs: null, antt: null, avisos };
    if (s.startsWith('S') && cat.cod !== 'MOD') avisos.push('Sequencial com segmento (S01...) é só para modelo BIM; nos demais documentos use número.');
    const ccs = [ident, cat.cod, disc.cod, s, r].join('-');
    const c = siglaAntt(cat.antt, 'categoria');
    const d = siglaAntt(disc.antt, 'disciplina');
    let antt = null;
    if (c.sigla && d.sigla && !s.startsWith('S')) antt = [ident, c.sigla, d.sigla, s, r].join('-');
    for (const x of [c, d]) if (x.aviso) avisos.push(x.aviso);
    if (c.sigla && d.sigla && s.startsWith('S')) avisos.push('No nome ANTT o sequencial é numérico: informe o número do modelo para gerar o nome de protocolo.');
    return { ident, ccs, antt, avisos };
  }

  /** Caminho no SharePoint da zona. Devolve níveis, quantos já existem, o link da pasta existente mais funda
      e o caminho em texto (nomes exibidos, para o projetista conferir; não é URL). */
  function caminho({ site, lib, pasta, tramo, fase, ddd, ttt }) {
    const niveis = [BIBLIOTECAS[lib]];
    let existe = 1;
    if (pasta) { niveis.push(pasta); existe = 2; }
    else if (tramo) niveis.push(SEM_SEGMENTO);  // tramos da Z00 ainda sem pasta de segmento
    if (tramo) {
      niveis.push(tramo);
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

  /** Segmento que contém o km na rodovia (local informado à mão). Intervalo semiaberto [início, fim):
      o km de fronteira fica no segmento que começa nele; o fim do último segmento da rodovia vale como dentro. */
  function localizarSegmento(dados, rodovia, km) {
    const k = Number(km);
    const daRodovia = dados.segmentos.filter(s => s.rodovia === rodovia);
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

  /** Lê dados.js (window.CCS_DADOS = {...};) fora do navegador. */
  function lerDadosArquivo(arquivo) {
    const txt = require('fs').readFileSync(arquivo, 'utf8');
    return JSON.parse(txt.slice(txt.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  }

  const api = { CONCESSIONARIA, BIBLIOTECAS, blocoLocal, identificador, normSeq, normRev, montar, caminho,
                normalizar, filtrar, localizarSegmento, lerKm, fmtKm, lerDadosArquivo, SEM_SEGMENTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CCSCore = api;
})(this);
