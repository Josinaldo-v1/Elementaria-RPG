/* Núcleo do site: dados, estado da mesa, registro, rotas, gaveta, bandeja de dados. */
(function () {
  "use strict";
  const D = window.ELEMENTARIA;
  const R = window.Regras;
  const App = (window.App = { D, vistas: {} });
  const CHAVE = "elementaria.mesa.v1";

  // ───────── Visão (jogador × mestre), por aba ─────────
  // O grupo joga junto: na visão do jogador nada marcado como "mestre"/"privado" no vault aparece.
  // Os dados do mestre só existem nesta aba se ela carregou js/dados-mestre.js (ver index.html).
  const M = window.ELEMENTARIA_MESTRE;
  App.mestre = !!M;
  if (M) {
    for (const [lista, regs] of Object.entries(M.registros || {})) {
      const existentes = new Set((D[lista] || []).map((x) => x.id));
      // Nota do mestre com o mesmo nome de uma nota pública (ex.: duas "Marth Atarah"): não sobrescreve a pública.
      D[lista] = (D[lista] || []).concat(regs.map((r) => Object.assign({}, r, { soMestre: true }, existentes.has(r.id) ? { id: `${r.id} (mestre)` } : {})));
    }
    for (const [chave, texto] of Object.entries(M.extras || {})) {
      const [lista, ...id] = chave.split(":");
      const it = (D[lista] || []).find((x) => x.id === id.join(":"));
      if (it) it.conteudoMestre = texto;
    }
  }
  App.trocarVisao = function (mestre) {
    try { sessionStorage.setItem("elementaria.visao", mestre ? "mestre" : "jogador"); } catch (e) { /* segue */ }
    location.reload();
  };

  // ───────── Utilidades ─────────
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString("pt-BR"));
  const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const uid = () => Math.random().toString(36).slice(2, 9);
  const hora = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const iniciais = (nome) => String(nome || "?").split(/\s+/).filter((w) => /^[A-Za-zÀ-ú]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  Object.assign(App, { esc, fmt, slug, uid, hora, iniciais });

  // ───────── Índices ─────────
  const idx = {};
  const tipos = { personagens: "personagem", companheiros: "companheiro", inimigos: "inimigo", invocacoes: "invocacao", npcs: "npc",
    poderes: "poder", condicoes: "condicao", regras: "regra", pericias: "pericia", modificadores: "modificador", elementos: "elemento",
    itens: "item", classes: "classe", afinidades: "afinidade", periciasEspeciais: "periciaEspecial" };
  for (const [lista, tipo] of Object.entries(tipos)) {
    idx[tipo] = {};
    for (const it of D[lista] || []) idx[tipo][it.id] = it;
  }
  // nome (sem acento/caixa) → nota, para resolver [[links]] e aliases
  const porNome = {};
  const ordemBusca = ["condicao", "regra", "poder", "pericia", "modificador", "elemento", "afinidade", "item", "personagem", "companheiro", "invocacao", "inimigo", "periciaEspecial", "classe", "npc"];
  for (const tipo of ordemBusca.slice().reverse()) {
    for (const it of Object.values(idx[tipo])) {
      for (const n of [it.id, it.nome, ...(it.aliases || [])]) if (n) porNome[slug(n)] = { tipo, item: it };
    }
  }
  App.idx = idx;
  App.buscarNota = (nome) => porNome[slug(String(nome).replace(/\.md$/, ""))] || null;

  // Elementos e modificadores: cor, ícone e ligação modificador → elemento
  const ELEM = {};
  for (const e of D.elementos) ELEM[e.chave] = { nome: e.nome, icone: e.icone, cor: `var(--${e.chave === "vida" ? "vida-el" : e.chave})`, modificador: e.modificador };
  const MOD = {};
  for (const m of D.modificadores) MOD[m.chave] = { nome: m.nome, icone: m.icone, elemento: slug(m.elemento), pericias: m.pericias || [] };
  App.ELEM = ELEM;
  App.MOD = MOD;
  App.ORDEM_MOD = ["agilidade", "precisao", "forca", "constituicao", "inteligencia", "sabedoria", "carisma", "medo", "fe", "vitalidade", "vigor", "energia", "sina"]
    .filter((k) => MOD[k]);
  App.corElemento = (nome) => (nome && ELEM[slug(nome)] ? ELEM[slug(nome)].cor : null);
  App.corModificador = (nome) => { const m = MOD[slug(nome)]; return m ? ELEM[m.elemento]?.cor : null; };

  // ───────── Markdown das notas do Obsidian (subconjunto) ─────────
  function inline(txt) {
    let s = esc(txt);
    s = s.replace(/!\[\[[^\]]+\]\]/g, "");
    s = s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, alvo, rot) => {
      const achou = App.buscarNota(alvo.replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
      const texto = rot || alvo;
      return achou ? `<a class="wiki" data-nota="${alvo}">${texto}</a>` : `<a class="wiki sem-nota" title="Sem nota no site">${texto}</a>`;
    });
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
    return s;
  }
  function markdown(md) {
    const linhas = String(md || "").replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      if (/^>/.test(l)) {
        const bloco = [];
        while (i < linhas.length && /^>/.test(linhas[i])) bloco.push(linhas[i++].replace(/^>\s?/, ""));
        const m = bloco[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        if (m) {
          out.push(`<div class="callout ${esc(m[1].toLowerCase())}">${m[2] ? `<div class="titulo-callout">${inline(m[2])}</div>` : ""}${markdown(bloco.slice(1).join("\n"))}</div>`);
        } else out.push(`<div class="callout quote">${markdown(bloco.join("\n"))}</div>`);
        continue;
      }
      const h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) { const n = Math.min(h[1].length + 1, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
      if (/^\|/.test(l)) {
        const rows = [];
        while (i < linhas.length && /^\|/.test(linhas[i])) rows.push(linhas[i++]);
        const cel = (r) => r.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());
        const corpo = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
        const [cab, ...resto] = corpo;
        out.push(`<table><thead><tr>${cel(cab).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${resto.map((r) => `<tr>${cel(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const itens = [];
        const ord = /^\s*\d+\./.test(l);
        while (i < linhas.length && /^\s*([-*]|\d+\.)\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        out.push(`<${ord ? "ol" : "ul"}>${itens.map((t) => `<li>${inline(t)}</li>`).join("")}</${ord ? "ol" : "ul"}>`);
        continue;
      }
      if (/^---+$/.test(l)) { out.push("<hr>"); i++; continue; }
      const par = [];
      while (i < linhas.length && !/^\s*$/.test(linhas[i]) && !/^(>|#|\||\s*[-*]\s|---)/.test(linhas[i])) par.push(linhas[i++]);
      if (!par.length) { out.push(`<p>${inline(l)}</p>`); i++; continue; }
      out.push(`<p>${par.map(inline).join("<br>")}</p>`);
    }
    return out.join("");
  }
  App.markdown = markdown;

  // ───────── Estado da mesa ─────────
  function acharEntidade(nome) {
    for (const tipo of ["personagem", "companheiro", "inimigo", "invocacao", "npc"]) {
      const it = idx[tipo][nome] || Object.values(idx[tipo]).find((x) => slug(x.nome) === slug(nome) || (x.aliases || []).some((a) => slug(a) === slug(nome)));
      if (it) return { tipo, id: it.id };
    }
    return null;
  }
  App.acharEntidade = acharEntidade;
  App.entidade = (p) => (p && p.ref ? idx[p.ref.tipo]?.[p.ref.id] : null);

  function lerCondicao(txt) {
    if (!txt) return [];
    const m = String(txt).match(/^(.*?)(?:\s+(I{1,3}))?$/);
    const c = App.buscarNota(m[1]);
    return [{ nome: c && c.tipo === "condicao" ? c.item.nome : m[1].trim(), estagio: m[2] || null, desde: null }];
  }
  App.lerCondicao = lerCondicao;

  const TIPOS = { player: "PLAYER", aliado: "ALIADO", boss: "BOSS", inimigo: "INIMIGO", "mini boss": "MINI BOSS", companheiro: "ALIADO" };
  App.ladoDoTipo = (t) => (t === "PLAYER" || t === "ALIADO" ? "aliado" : "inimigo");

  function novoParticipante(base) {
    const ref = base.ref || acharEntidade(base.nome);
    const ent = ref ? idx[ref.tipo][ref.id] : null;
    const tipo = base.tipo || (ref?.tipo === "personagem" ? "PLAYER" : ref?.tipo === "companheiro" || ref?.tipo === "invocacao" ? "ALIADO"
      : ref?.tipo === "inimigo" ? ((ent?.categoria || "").toLowerCase().includes("boss") ? "BOSS" : "INIMIGO") : "INIMIGO");
    const vidaMax = base.vidaMax ?? ent?.vida_total ?? null;
    const manaMax = base.manaMax ?? ent?.mana_total ?? null;
    return {
      id: uid(), ref, nome: base.nome || ent?.nome || "Sem nome", tipo, lado: App.ladoDoTipo(tipo), ordem: base.ordem ?? 99,
      vida: base.vida ?? vidaMax, vidaMax, mana: base.mana ?? manaMax, manaMax,
      morrerMax: ent?.morrer ?? null, morrerUsados: base.morrerUsados || 0,
      predMax: ent?.predestinacao ?? null, predUsados: base.predUsados || 0,
      condicoes: base.condicoes || lerCondicao(base.condicao), acaoLendaria: false, estado: "ativo",
      noMapa: true, x: null, y: null, tam: tipo === "BOSS" ? 2 : 1, notas: "",
    };
  }
  App.novoParticipante = novoParticipante;

  function estadoInicial() {
    const b = D.batalhaInicial;
    const participantes = (b?.participantes || []).map((p) => novoParticipante({ ...p, tipo: TIPOS[String(p.tipo).toLowerCase()] || "INIMIGO" }));
    return {
      versao: 1,
      batalha: { titulo: b?.titulo || "Nova batalha", data: b?.data || null, turno: b?.turno || 1, turnosTotal: b?.turnosTotal || null, vez: participantes[0]?.id || null },
      participantes,
      log: [{ t: Date.now(), texto: b ? `Batalha "${b.titulo}" carregada do vault — turno ${b.turno} de ${b.turnosTotal}.` : "Mesa criada.", auto: true }],
      rolagens: [],
      usos: {},
      mapa: { celula: 56, grade: true, ox: 0, oy: 0, colunas: 30, linhas: 20, zoom: 1, px: 30, py: 30, distancia: "", metros: "", imagem: false, larguraImg: 0, alturaImg: 0 },
    };
  }
  App.estadoInicial = estadoInicial;

  function carregar() {
    try {
      const s = localStorage.getItem(CHAVE);
      if (s) return JSON.parse(s);
    } catch (e) { /* armazenamento indisponível: segue em memória */ }
    return estadoInicial();
  }
  App.estado = carregar();
  const desfazer = [];

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(App.estado)); } catch (e) { aviso("Não consegui salvar no navegador — exporte um backup."); }
  }
  App.salvar = salvar;

  /** Toda alteração passa por aqui: guarda para desfazer, registra no log, salva e redesenha. */
  App.mudar = function (texto, fn, opts) {
    opts = opts || {};
    desfazer.push(JSON.stringify(App.estado));
    if (desfazer.length > 40) desfazer.shift();
    fn(App.estado);
    if (texto) registrar(texto, opts.auto);
    salvar();
    if (!opts.semRedesenho) redesenhar();
  };
  App.podeDesfazer = () => desfazer.length > 0;
  App.desfazer = function () {
    if (!desfazer.length) return;
    const ultimo = App.estado.log[App.estado.log.length - 1];
    App.estado = JSON.parse(desfazer.pop());
    salvar();
    aviso(`Desfeito: ${ultimo ? ultimo.texto : "última ação"}`);
    redesenhar();
  };
  function registrar(texto, auto) {
    App.estado.log.push({ t: Date.now(), texto, auto: !!auto });
    if (App.estado.log.length > 500) App.estado.log.splice(0, App.estado.log.length - 500);
  }
  App.registrar = registrar;
  App.reiniciar = function () {
    desfazer.push(JSON.stringify(App.estado));
    App.estado = estadoInicial();
    salvar();
    redesenhar();
  };

  // Outra aba mudou a mesa (ex.: mestre no notebook, mapa na TV)
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE || !e.newValue) return;
    try { App.estado = JSON.parse(e.newValue); redesenhar(); } catch (err) { /* ignora */ }
  });

  // ───────── Participantes e ações de combate ─────────
  App.participantes = () => App.estado.participantes.slice().sort((a, b) => a.ordem - b.ordem);
  App.part = (id) => App.estado.participantes.find((p) => p.id === id);
  App.retratoDe = (p) => { const e = App.entidade(p); return e?.retrato || null; };
  App.corDe = function (p) {
    const e = App.entidade(p);
    if (p.lado === "inimigo") return "var(--vida)";
    return App.corElemento(e?.afinidade) || (p.tipo === "ALIADO" ? "var(--luz)" : "var(--texto-3)");
  };
  App.htmlRetrato = function (p, classe, estilo) {
    const url = App.retratoDe(p);
    return `<span class="retrato ${classe || ""}" style="--anel:${App.corDe(p)};${estilo || ""}">${url ? `<img src="${url}" alt="" loading="lazy">` : esc(iniciais(p.nome))}</span>`;
  };

  function comConsequencias(p, antes) {
    for (const c of R.consequencias(antes, p)) {
      if (c.tipo === "condicao" && !p.condicoes.some((x) => x.nome === c.nome)) {
        p.condicoes.push({ nome: c.nome, estagio: null, desde: App.estado.batalha.turno });
        registrar(`${p.nome} recebeu ${c.nome} (${c.motivo} — regra: ${c.fonte}).`, true);
      }
      if (c.tipo === "estado") {
        p.estado = c.nome;
        registrar(`${p.nome}: ${c.motivo} (regra: ${c.fonte}).`, true);
      }
    }
  }
  const copia = (p) => JSON.parse(JSON.stringify(p));

  App.alterarVida = function (id, delta, rotulo) {
    const p = App.part(id);
    if (!p) return;
    if (p.vida === null || p.vida === undefined) { aviso(`Defina a vida de ${p.nome} antes (botão Editar).`); return; }
    App.mudar(null, () => {
      const antes = copia(p);
      p.vida = p.vida + delta;
      registrar(`${p.nome} ${delta < 0 ? "recebeu " + fmt(-delta) + " de dano" : "recuperou " + fmt(delta) + " de vida"}${rotulo ? " (" + rotulo + ")" : ""} — vida ${fmt(antes.vida)} → ${fmt(p.vida)}.`);
      if (p.vidaMax && p.vida > p.vidaMax) registrar(`${p.nome} ficou acima da vida total (${fmt(p.vida)}/${fmt(p.vidaMax)}). Regra de sobrecura não documentada — ajuste se precisar.`, true);
      comConsequencias(p, antes);
    });
  };
  App.alterarMana = function (id, delta, rotulo) {
    const p = App.part(id);
    if (!p) return false;
    if (p.mana === null || p.mana === undefined) { aviso(`${p.nome} não tem mana registrada.`); return false; }
    if (delta < 0 && p.mana + delta < 0) { aviso(`${p.nome} tem só ${fmt(p.mana)} de mana — faltam ${fmt(-(p.mana + delta))}.`); return false; }
    App.mudar(null, () => {
      const antes = copia(p);
      p.mana = p.mana + delta;
      registrar(`${p.nome} ${delta < 0 ? "gastou " + fmt(-delta) : "recuperou " + fmt(delta)} de mana${rotulo ? " (" + rotulo + ")" : ""} — mana ${fmt(antes.mana)} → ${fmt(p.mana)}.`);
      comConsequencias(p, antes);
    });
    return true;
  };
  App.definirCampo = function (id, campo, valor, rotulo) {
    const p = App.part(id);
    if (!p) return;
    App.mudar(`Mestre corrigiu ${rotulo || campo} de ${p.nome}: ${fmt(p[campo])} → ${valor === null ? "—" : fmt(valor)}.`, () => {
      const antes = copia(p);
      p[campo] = valor;
      comConsequencias(p, antes);
    });
  };
  App.marcarContador = function (id, campo, maxCampo, usados) {
    const p = App.part(id);
    const nomes = { morrerUsados: "Morrer", predUsados: "Predestinação" };
    App.mudar(`${p.nome}: ${nomes[campo]} ${p[campo]}/${p[maxCampo]} → ${usados}/${p[maxCampo]}.`, () => {
      const antes = copia(p);
      p[campo] = usados;
      comConsequencias(p, antes);
    });
  };
  App.adicionarCondicao = function (id, nome, estagio) {
    const p = App.part(id);
    App.mudar(`${p.nome} recebeu ${nome}${estagio ? " " + estagio : ""}.`, () => {
      p.condicoes = p.condicoes.filter((c) => c.nome !== nome);
      p.condicoes.push({ nome, estagio: estagio || null, desde: App.estado.batalha.turno });
    });
  };
  App.removerCondicao = function (id, nome) {
    const p = App.part(id);
    App.mudar(`${p.nome} perdeu ${nome}.`, () => { p.condicoes = p.condicoes.filter((c) => c.nome !== nome); });
  };

  // ───────── Rotas ─────────
  let vistaAtual = null;
  function rota() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [nome, ...resto] = h.split("/");
    return { nome: nome || "inicio", param: resto.join("/") };
  }
  function redesenhar() {
    const r = rota();
    const v = App.vistas[r.nome] || App.vistas.inicio;
    document.querySelectorAll(".trilho a[data-rota]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.rota === (r.nome === "ficha" ? "fichas" : r.nome)));
    document.querySelectorAll(".trilho a[aria-current]").forEach((a) => a.setAttribute("aria-current", "page"));
    const el = document.getElementById("vista");
    const mesmaVista = vistaAtual && vistaAtual.v === v && vistaAtual.param === r.param;
    if (mesmaVista && v.atualizar) v.atualizar(el, r.param);
    else {
      if (vistaAtual?.v?.sair) vistaAtual.v.sair();
      el.innerHTML = "";
      v.render(el, r.param);
      if (!mesmaVista) window.scrollTo(0, 0);
    }
    vistaAtual = { v, param: r.param };
    atualizarHistorico();
  }
  App.redesenhar = redesenhar;
  App.ir = (h) => { location.hash = h; };
  window.addEventListener("hashchange", () => { vistaAtual = null; redesenhar(); });

  // ───────── Aviso ─────────
  function aviso(texto) {
    const box = document.querySelector(".avisos");
    const d = document.createElement("div");
    d.className = "aviso";
    d.setAttribute("role", "status");
    d.textContent = texto;
    box.appendChild(d);
    setTimeout(() => d.remove(), 3800);
  }
  App.aviso = aviso;

  // ───────── Gaveta lateral ─────────
  let focoAnterior = null;
  App.abrirGaveta = function (titulo, html, aoAbrir) {
    const g = document.querySelector(".gaveta");
    focoAnterior = document.activeElement;
    g.querySelector("h2").textContent = titulo;
    const corpo = g.querySelector(".corpo");
    corpo.innerHTML = html;
    corpo.scrollTop = 0;
    g.classList.add("aberta");
    g.setAttribute("aria-hidden", "false");
    document.querySelector(".gaveta-fundo").classList.add("aberta");
    g.querySelector(".fechar").focus();
    if (aoAbrir) aoAbrir(corpo);
  };
  App.fecharGaveta = function () {
    const g = document.querySelector(".gaveta");
    if (!g.classList.contains("aberta")) return;
    g.classList.remove("aberta");
    g.setAttribute("aria-hidden", "true");
    document.querySelector(".gaveta-fundo").classList.remove("aberta");
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  };
  App.abrirNota = function (nome) {
    const n = App.buscarNota(nome);
    if (!n) { aviso(`"${nome}" não tem nota no vault.`); return; }
    const it = n.item;
    const conteudo = it.conteudo ? markdown(it.conteudo) : `<p class="sutil">Esta nota não tem texto no vault.</p>`;
    const extra = n.tipo === "personagem" ? `<p><a class="btn mini" href="#/ficha/${encodeURIComponent(it.id)}">Abrir ficha</a></p>` : "";
    const selo = it.soMestre ? `<p><span class="selo-conflito">Só o mestre vê esta nota</span></p>` : "";
    const segredo = it.conteudoMestre ? `<div class="callout warning segredo"><div class="titulo-callout">Só o mestre vê</div>${markdown(it.conteudoMestre)}</div>` : "";
    App.abrirGaveta(it.nome || it.id, `${extra}${selo}<div class="nota">${conteudo}${segredo}</div>`);
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.wiki[data-nota]");
    if (a) { e.preventDefault(); App.abrirNota(a.dataset.nota); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") App.fecharGaveta();
    const alvo = e.target;
    const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT");
    if (digitando) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); App.desfazer(); }
    else if (e.key === "d" && !e.ctrlKey && !e.metaKey) App.abrirDados();
  });

  // ───────── Bandeja de dados ─────────
  const ROTULO_ESPECIAL = { critico: "Acerto crítico", super: "Super crítico", falha: "Falha crítica", desastre: "Desastre", anulado: "Anulado (dois 20 × dois 1)", marca20: "20 natural" };
  function htmlResultado(r, animar) {
    if (r.erro) return `<div class="resultado-rolagem"><p>${esc(r.erro)}</p></div>`;
    const faces = r.valores.map((v, i) => {
      const usada = r.escolhido !== undefined && v === r.escolhido && r.valores.indexOf(v) === i;
      return `<span class="face${usada ? " usada" : ""}${v === 20 ? " v20" : ""}${v === 1 ? " v1" : ""}${animar ? " rolando" : ""}" data-final="${v}">${v}</span>`;
    }).join("");
    const esp = r.especial && r.especial.tipo !== "normal" ? `<span class="especial ${r.especial.tipo}" title="${esc(r.especial.nota || "")}">${ROTULO_ESPECIAL[r.especial.tipo] || r.especial.tipo}</span>` : "";
    return `<div class="resultado-rolagem" aria-live="polite">
      <div class="rotulo">${esc(r.quem ? r.quem + " · " : "")}${esc(r.rotulo || r.expressao)} <span class="fraco">${esc(r.tipo)}</span></div>
      <div class="total">${fmt(r.total)}</div>
      <div class="faces">${faces}</div>
      ${esp}
      ${r.duvida ? `<div style="margin-top:6px"><span class="selo-duvida" title="${esc(r.duvida)}">Resultado = maior dado? (dúvida no vault)</span></div>` : ""}
      <ol class="explicacao">${(r.explicacao || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    </div>`;
  }
  function animarFaces(raiz) {
    const faces = raiz.querySelectorAll(".face.rolando");
    if (!faces.length) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fim = () => faces.forEach((f) => { f.textContent = f.dataset.final; f.classList.remove("rolando"); });
    if (reduzir) return fim();
    const t = setInterval(() => faces.forEach((f) => { f.textContent = 1 + Math.floor(Math.random() * 20); }), 55);
    setTimeout(() => { clearInterval(t); fim(); }, 520);
  }
  function atualizarHistorico() {
    const ul = document.querySelector(".gaveta .historico");
    if (!ul) return;
    ul.innerHTML = App.estado.rolagens.slice().reverse().slice(0, 30).map((r) =>
      `<li><div>${esc(r.quem ? r.quem + " · " : "")}${esc(r.rotulo || r.expressao)}</div><b>${fmt(r.total)}</b><span>${hora(r.t)} · ${esc(r.expressao)} → ${esc(r.valores.join(", "))}${r.especial && r.especial.tipo !== "normal" ? " · " + esc(ROTULO_ESPECIAL[r.especial.tipo] || "") : ""}</span></li>`
    ).join("") || `<li><div class="sutil">Nenhuma rolagem ainda.</div></li>`;
  }

  /** Registra uma rolagem na mesa e mostra na bandeja. */
  App.registrarRolagem = function (r, quem) {
    if (r.erro) { App.abrirDados(r); return; }
    r.quem = quem || r.quem || null;
    r.t = Date.now();
    App.mudar(`${r.quem ? r.quem + " rolou " : "Rolagem: "}${r.rotulo || r.expressao} → ${r.total}${r.especial && r.especial.tipo !== "normal" ? " (" + (ROTULO_ESPECIAL[r.especial.tipo] || "") + ")" : ""}.`,
      (s) => { s.rolagens.push(r); if (s.rolagens.length > 80) s.rolagens.shift(); }, { semRedesenho: true });
    App.abrirDados(r, true);
  };

  App.abrirDados = function (resultado, animar) {
    const html = `<div class="rolador">
      <form class="form-rolar">
        <label class="visualmente-oculto" for="expr">Expressão de dados</label>
        <input id="expr" type="text" placeholder="Ex.: 2d6+5, 1d20+8, 3d8+4" autocomplete="off">
        <button class="btn primario" type="submit">Rolar</button>
      </form>
      <div class="dados-rapidos">${["d4", "d6", "d8", "d10", "d12", "d20", "d100"].map((d) => `<button class="btn mini" type="button" data-rapido="1${d}">${d}</button>`).join("")}</div>
      <div class="resultado-atual">${resultado ? htmlResultado(resultado, animar) : `<p class="sutil">Digite uma expressão ou clique numa perícia da ficha. Atalho: tecla <b>D</b>.</p>`}</div>
      <h3>Histórico</h3>
      <ul class="historico"></ul>
    </div>`;
    App.abrirGaveta("Dados", html, (corpo) => {
      atualizarHistorico();
      animarFaces(corpo);
      const inp = corpo.querySelector("#expr");
      if (!resultado) inp.focus();
      corpo.querySelector(".form-rolar").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!inp.value.trim()) { inp.focus(); return; }
        const r = R.rolarExpressao(inp.value);
        if (r.erro) { corpo.querySelector(".resultado-atual").innerHTML = htmlResultado(r); return; }
        App.registrarRolagem(r, "Mestre");
      });
      corpo.querySelectorAll("[data-rapido]").forEach((b) => b.addEventListener("click", () => App.registrarRolagem(R.rolarExpressao(b.dataset.rapido), "Mestre")));
    });
  };

  // ───────── Diálogos simples ─────────
  App.confirmar = (msg) => window.confirm(msg);

  // ───────── Início ─────────
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".botao-dados").addEventListener("click", () => App.abrirDados());
    document.querySelector(".gaveta .fechar").addEventListener("click", App.fecharGaveta);
    document.querySelector(".gaveta-fundo").addEventListener("click", App.fecharGaveta);
    document.getElementById("gerado").textContent = `Dados do vault: ${D.geradoEm}`;
    const bv = document.getElementById("visao");
    bv.textContent = App.mestre ? "Visão do mestre" : "Visão do jogador";
    bv.setAttribute("aria-pressed", String(App.mestre));
    bv.title = App.mestre ? "Esta aba mostra segredos do mestre. Clique para voltar à visão do jogador." : "Clique para ver os segredos do mestre nesta aba.";
    bv.addEventListener("click", () => {
      if (App.mestre) App.trocarVisao(false);
      else if (App.confirmar("Mostrar os segredos do mestre nesta aba? Confira se nenhum jogador está vendo a tela.")) App.trocarVisao(true);
    });
    document.body.classList.toggle("modo-mestre", App.mestre);
    redesenhar();
  });
})();
