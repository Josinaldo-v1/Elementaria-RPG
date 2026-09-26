/* Motor de regras — Elementaria
 * Funções puras, sem DOM. Rodam no navegador (window.Regras) e no Node (testes).
 * Cada regra implementada cita a nota do vault de onde veio. O que o vault marca como
 * [DÚVIDA] aparece no resultado como `duvida`, nunca como verdade silenciosa.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Regras = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ───────── Aleatoriedade (injetável para testes) ─────────
  function criarRng(semente) {
    // mulberry32
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Sequência fixa de resultados (testes): sequencia([20, 1, 5]) devolve esses dados em ordem. */
  function sequencia(valores, lados) {
    let i = 0;
    return function () {
      const v = valores[i++ % valores.length];
      return (v - 1 + 0.5) / (lados || 20);
    };
  }
  const rngPadrao = Math.random;
  function rolarDado(lados, rng) {
    return 1 + Math.floor((rng || rngPadrao)() * lados);
  }
  function rolar(qtd, lados, rng) {
    const out = [];
    for (let i = 0; i < qtd; i++) out.push(rolarDado(lados, rng));
    return out;
  }

  // ───────── Quantidade de dados ─────────
  // Fonte: vault › 01 Regras › Tipos de Teste — "dados = 1 + (modificador ÷ 4, arredondado para baixo)".
  function quantidadeDados(mod) {
    const m = Number(mod) || 0;
    return Math.max(1, 1 + Math.floor(m / 4));
  }

  // ───────── Resultados especiais (Xd20) ─────────
  // Fontes: Acerto Crítico, Super Crítico, Falha Crítica, Desastre, Desvantagem.
  function classificarEspeciais(valores, opts) {
    opts = opts || {};
    if (opts.desvantagem) return { tipo: "normal", nota: "Com desvantagem não há crítico, super crítico, falha crítica nem desastre." };
    const uns = valores.filter((v) => v === 1).length;
    const vintes = valores.filter((v) => v === 20).length;
    if (uns >= 3) return { tipo: "desastre", nota: "Três ou mais 1: fracasso imediato + efeito negativo." };
    if (vintes >= 3) return { tipo: "super", nota: "Três 20: super crítico (sobrepõe a falha crítica)." };
    if (uns >= 2 && vintes >= 2) return { tipo: "anulado", nota: "Dois 20 e dois 1 se anulam; vale o maior resultado." };
    if (uns >= 2) return { tipo: "falha", nota: "Dois 1: falha crítica — fracasso imediato (sobrepõe o crítico)." };
    if (vintes >= 1) return { tipo: "critico", nota: "Tirou 20: acerto crítico." };
    return { tipo: "normal" };
  }

  // ───────── Testes ─────────
  /** Somatório: 1d20 + modificador. Vantagem/desvantagem: 2d20, fica o maior/menor.
   *  Não existe falha crítica, super crítico nem desastre em somatório; crítico = tirar 20. */
  function testeSomatorio(mod, opts, rng) {
    opts = opts || {};
    const m = Number(mod) || 0;
    const dois = opts.vantagem || opts.desvantagem;
    const valores = rolar(dois ? 2 : 1, 20, rng);
    const escolhido = opts.desvantagem ? Math.min(...valores) : Math.max(...valores);
    const critico = !opts.desvantagem && escolhido === 20;
    return {
      tipo: "Somatório",
      expressao: (dois ? "2d20" : "1d20") + (m >= 0 ? "+" : "") + m,
      valores, escolhido, mod: m, total: escolhido + m,
      especial: critico ? { tipo: "critico", nota: "Tirou 20: acerto crítico." } : { tipo: "normal" },
      explicacao: [
        `${dois ? "2d20 (" + (opts.vantagem ? "vantagem, fica o maior" : "desvantagem, fica o menor") + ")" : "1d20"} → ${valores.join(", ")}`,
        `dado usado: ${escolhido}`,
        `+ modificador: ${m}`,
        `= ${escolhido + m}`,
      ],
    };
  }

  /** Xd20 / Xd100: N dados, N = 1 + ⌊mod/4⌋. Vantagem: +1 dado. Desvantagem: fica o pior
   *  (com 1 dado, rola 2). O resultado do teste ser o MAIOR dado é [DÚVIDA] no vault. */
  function testeXd(mod, lados, opts, rng) {
    opts = opts || {};
    lados = lados || 20;
    const m = Number(mod) || 0;
    // opts.dados: quantidade já escrita na ficha (ex.: "Acerto: ❄️ 3d20")
    let n = opts.dados || quantidadeDados(m);
    if (opts.vantagem) n += 1;
    if (opts.desvantagem && n === 1) n = 2;
    const valores = rolar(n, lados, rng);
    const escolhido = opts.desvantagem ? Math.min(...valores) : Math.max(...valores);
    const especial = lados === 20 ? classificarEspeciais(valores, opts) : { tipo: "normal" };
    return {
      tipo: "X" + "d" + lados,
      expressao: `${n}d${lados}`,
      valores, escolhido, mod: m, total: escolhido,
      especial,
      duvida: opts.desvantagem ? null : "Resultado = maior dado? (vault › Tipos de Teste marca como [DÚVIDA])",
      explicacao: [
        (opts.dados ? `quantidade escrita na ficha: ${opts.dados} dado(s)` : `modificador ${m} → ${quantidadeDados(m)} dado(s)`) + (opts.vantagem ? " + 1 (vantagem)" : ""),
        `${n}d${lados} → ${valores.join(", ")}`,
        opts.desvantagem ? `desvantagem: fica o pior → ${escolhido}` : `maior dado → ${escolhido}`,
      ],
    };
  }

  /** Rola uma perícia para um modificador conhecido (rolagem vem da nota da perícia). */
  function testePericia(pericia, valorMod, opts, rng) {
    if (valorMod === null || valorMod === undefined)
      return { erro: `Sem valor de ${pericia.modificador} na ficha — preencha no Obsidian.` };
    let r;
    if (pericia.rolagem === "Somatório") r = testeSomatorio(valorMod, opts, rng);
    else if (pericia.rolagem === "Xd100") r = testeXd(valorMod, 100, opts, rng);
    else r = testeXd(valorMod, 20, opts, rng);
    r.rotulo = `${pericia.nome} (${pericia.modificador})`;
    return r;
  }

  /** Teste escrito numa ficha de poder: "1d20+28 [Vitalidade]" (somatório) ou "3d20 [Gelo]" (Xd20). */
  function testeEscrito(txt, opts, rng) {
    const m = String(txt || "").match(/(\d+)d(\d+)\s*(?:\+\s*(\d+))?/i);
    if (!m) return null;
    const n = +m[1], lados = +m[2], mod = m[3] ? +m[3] : 0;
    if (n === 1 && lados === 20) return testeSomatorio(mod, opts, rng);
    if (lados === 20 && !m[3]) return testeXd(0, 20, Object.assign({}, opts, { dados: n }), rng);
    return rolarExpressao(m[0].replace(/\s+/g, ""), rng);
  }

  // ───────── Expressões livres: "2d6+5", "3d8 + 4 - 1d4" ─────────
  function parseExpressao(txt) {
    const limpo = String(txt || "").replace(/\s+/g, "").toLowerCase();
    if (!limpo) return null;
    const partes = limpo.match(/[+-]?[^+-]+/g);
    if (!partes) return null;
    const termos = [];
    let mod = 0;
    for (const p of partes) {
      const sinal = p[0] === "-" ? -1 : 1;
      const corpo = p.replace(/^[+-]/, "");
      const d = corpo.match(/^(\d*)d(\d+)$/);
      if (d) {
        const qtd = d[1] === "" ? 1 : parseInt(d[1], 10);
        const lados = parseInt(d[2], 10);
        if (qtd < 1 || qtd > 200 || lados < 2 || lados > 1000) return null;
        termos.push({ qtd, lados, sinal });
      } else if (/^\d+$/.test(corpo)) {
        mod += sinal * parseInt(corpo, 10);
      } else return null;
    }
    if (!termos.length && !mod) return null;
    return { termos, mod };
  }

  function rolarExpressao(txt, rng) {
    const p = parseExpressao(txt);
    if (!p) return { erro: `Não entendi "${txt}". Use algo como 2d6+5 ou 1d20+8.` };
    let total = p.mod;
    const grupos = p.termos.map((t) => {
      const valores = rolar(t.qtd, t.lados, rng);
      const soma = valores.reduce((a, b) => a + b, 0);
      total += t.sinal * soma;
      return { ...t, valores, soma };
    });
    const todos20 = grupos.filter((g) => g.lados === 20).flatMap((g) => g.valores);
    return {
      tipo: "Livre",
      expressao: String(txt).replace(/\s+/g, ""),
      grupos, mod: p.mod, total,
      valores: grupos.flatMap((g) => g.valores),
      especial: todos20.includes(20) ? { tipo: "marca20", nota: "Saiu um 20 natural." } : { tipo: "normal" },
      explicacao: grupos.map((g) => `${g.sinal < 0 ? "−" : ""}${g.qtd}d${g.lados} → ${g.valores.join(", ")} (soma ${g.soma})`)
        .concat(p.mod ? [`${p.mod > 0 ? "+" : "−"} ${Math.abs(p.mod)}`] : [], [`= ${total}`]),
    };
  }

  // ───────── Iniciativa ─────────
  // Fonte: vault › Iniciativa (regra) — Xd100 em Energia; empate desempata pelo valor do modificador.
  function ordenarIniciativa(lista) {
    return lista.slice().sort((a, b) => (b.resultado - a.resultado) || ((b.mod || 0) - (a.mod || 0)));
  }

  // ───────── Consequências automáticas documentadas ─────────
  // Vida e Mana: "Ao zerar a mana, o jogador fica Exausto". Morrer: "Quando os pontos de vida zeram,
  // o personagem entra na condição Morrendo"; "Em caso de fracasso, um morrer base é removido.
  // Ao zerar, o personagem deixa de existir".
  function consequencias(antes, depois) {
    const out = [];
    const temCond = (p, nome) => (p.condicoes || []).some((c) => c.nome === nome);
    if (depois.vida !== null && depois.vida !== undefined && depois.vida <= 0 && !(antes.vida <= 0) && !temCond(depois, "Morrendo"))
      out.push({ tipo: "condicao", nome: "Morrendo", motivo: "vida chegou a 0", fonte: "Morrer" });
    if (depois.manaMax && depois.mana !== null && depois.mana <= 0 && !(antes.mana <= 0) && !temCond(depois, "Exausto"))
      out.push({ tipo: "condicao", nome: "Exausto", motivo: "mana chegou a 0", fonte: "Vida e Mana" });
    if (depois.morrerMax && depois.morrerUsados >= depois.morrerMax && antes.morrerUsados < antes.morrerMax)
      out.push({ tipo: "estado", nome: "morto", motivo: "todos os Morrer foram usados — o personagem deixa de existir", fonte: "Morrer" });
    return out;
  }

  return {
    criarRng, sequencia, rolarDado, rolar, quantidadeDados, classificarEspeciais,
    testeSomatorio, testeXd, testePericia, testeEscrito, parseExpressao, rolarExpressao,
    ordenarIniciativa, consequencias,
  };
});
