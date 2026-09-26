/* Fichas: galeria e ficha completa do personagem. */
(function () {
  "use strict";
  const { esc, fmt, slug, D, idx } = App;
  const R = window.Regras;
  const selecionado = {};        // modificador escolhido no anel, por personagem
  let modo = "normal";           // normal | vantagem | desvantagem
  let filtroPoder = "todos";

  const lista = (v) => (v === null || v === undefined ? [] : [].concat(v));
  const participanteDe = (id) => App.estado.participantes.find((p) => p.ref && p.ref.id === id);

  // Condições cujo texto no vault diz que o personagem perde as ações
  const CONDS_SEM_ACAO = new Set(D.condicoes.filter((c) => /perde(m)? (suas |as )?a[çc][õo]es|sem a[çc][õo]es/i.test(c.conteudo || "")).map((c) => c.nome));

  // ───────── Galeria ─────────
  function carta(ent, tipo) {
    const cor = App.corElemento(ent.afinidade) || "var(--texto-3)";
    const sub = tipo === "personagem" ? lista(ent.classe).join(" e ") || "Classe não cadastrada" : `Companheiro${ent.nivel ? ", nível " + ent.nivel : ""}`;
    return `<a class="carta" style="--anel:${cor}" href="#/ficha/${encodeURIComponent(ent.id)}">
      ${ent.retrato ? `<img src="${ent.retrato}" alt="" loading="lazy">` : `<span class="sem-retrato">${esc(App.iniciais(ent.nome))}</span>`}
      <span class="rodape"><b>${esc(ent.nome)}</b><span>${esc(sub)}</span></span>
    </a>`;
  }

  function galeria(el) {
    el.innerHTML = `
      <header class="cabeca"><div><h1>Fichas</h1><p>Personagens do grupo e companheiros. Os dados vêm do vault do Obsidian.</p></div></header>
      <div class="galeria">${D.personagens.map((p) => carta(p, "personagem")).join("")}</div>
      <h2 style="margin-top:30px">Companheiros</h2>
      <div class="galeria">${D.companheiros.map((c) => carta(c, "companheiro")).join("")}</div>`;
  }

  // ───────── Anel elemental ─────────
  function anel(ent) {
    const mods = ent.mods || {};
    const res = ent.res || {};
    const chaves = App.ORDEM_MOD;
    const afinMod = ent.afinidade ? Object.keys(App.MOD).find((k) => App.MOD[k].elemento === slug(ent.afinidade)) : null;
    const sel = selecionado[ent.id] || afinMod || chaves.slice().sort((a, b) => (mods[b] ?? -1) - (mods[a] ?? -1))[0];
    selecionado[ent.id] = sel;
    const nos = chaves.map((k, i) => {
      const m = App.MOD[k];
      const el = App.ELEM[m.elemento];
      const a = (-90 + (i * 360) / chaves.length) * (Math.PI / 180);
      const v = mods[k];
      return `<button class="no ${v === undefined ? "vazio" : ""}" type="button" style="--cor:${el.cor};left:${50 + 40 * Math.cos(a)}%;top:${50 + 40 * Math.sin(a)}%"
        data-mod="${k}" aria-pressed="${k === sel}" aria-label="${esc(m.nome)} (${esc(el.nome)}): ${v === undefined ? "sem valor" : v}">
        <span class="ic" aria-hidden="true">${m.icone}</span><span class="v">${v === undefined ? "—" : v}</span>
        ${v !== undefined ? `<span class="d" aria-hidden="true">${R.quantidadeDados(v)}d</span>` : ""}
      </button>`;
    }).join("");
    const m = App.MOD[sel];
    const el = App.ELEM[m.elemento];
    const v = mods[sel];
    const pericias = D.pericias.filter((p) => slug(p.modificador) === sel);
    const detalhe = `
      <div class="detalhe-mod" style="--cor:${el.cor}">
        <h3>${m.icone} ${esc(m.nome)}</h3>
        <p class="sutil" style="margin:0 0 12px">Elemento ${esc(el.nome)}${res[m.elemento] !== undefined ? `, resistência ${res[m.elemento]}` : ""}.
          ${v !== undefined ? `Testes somatório rolam <b>1d20+${v}</b>; testes Xd20 rolam <b>${R.quantidadeDados(v)}d20</b>.` : "Sem valor na ficha."}</p>
        <div class="segmentado" role="group" aria-label="Modo do teste" style="margin-bottom:10px">
          ${["normal", "vantagem", "desvantagem"].map((k) => `<button type="button" data-modo="${k}" aria-pressed="${modo === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}
        </div>
        <div class="lista-pericias">${pericias.map((p) => botaoPericia(p, v, el.cor)).join("")}</div>
      </div>`;
    return `<div class="anel-wrap">
      <div>
        <div class="anel" role="group" aria-label="Modificadores">
          <div class="orbita"></div>
          <div class="centro" style="--cor:${el.cor}"><div><div class="n">${v === undefined ? "—" : v}</div><div class="m">${esc(m.nome)}</div><div class="e">${esc(el.nome)}${v !== undefined ? ` · ${R.quantidadeDados(v)}d20` : ""}</div></div></div>
          ${nos}
        </div>
        <div class="anel-legenda"><span>Número grande: modificador</span><span>Selo: dados no teste Xd20 (1 + ⌊mod ÷ 4⌋)</span></div>
      </div>
      ${detalhe}
    </div>`;
  }

  function botaoPericia(p, v, cor) {
    const f = v === undefined ? "—" : p.rolagem === "Somatório" ? `1d20+${v}` : p.rolagem === "Xd100" ? `${R.quantidadeDados(v)}d100` : `${R.quantidadeDados(v)}d20`;
    return `<button class="pericia" type="button" style="--cor:${cor}" data-pericia="${esc(p.id)}" ${v === undefined ? "disabled" : ""}>
      <span aria-hidden="true">${p.icone || ""}</span><span>${esc(p.nome)}</span><span class="f">${f}</span></button>`;
  }

  function resistencias(ent) {
    if (!ent.res) return "";
    return `<h2>Resistências</h2><div class="linha-res">${Object.entries(App.ELEM).map(([k, e]) =>
      `<div class="res" style="--cor:${e.cor}">${e.icone} ${esc(e.nome)}<b>${ent.res[k] ?? "—"}</b></div>`).join("")}</div>
      <p class="fraco" style="font-size:14px">Como a resistência reduz o dano ainda não está documentado no vault.</p>`;
  }

  // ───────── Poderes ─────────
  function poderesDe(ent) {
    return D.poderes.filter((p) => lista(p.personagens).includes(ent.id));
  }
  function limiteUsos(txt) {
    const m = String(txt || "").match(/(\d+)\s*\/\s*(\d+)/);
    return m ? +m[2] : null;
  }
  function htmlPoderes(ent) {
    const todos = poderesDe(ent);
    if (!todos.length) return `<h2>Poderes</h2><p class="sutil">Nenhum poder ligado a este personagem no vault.</p>`;
    const filtrados = todos.filter((p) => filtroPoder === "todos" || (p.categoria || "").toLowerCase() === filtroPoder);
    const part = participanteDe(ent.id);
    const usos = (App.estado.usos || {})[ent.id] || {};
    const grupos = {};
    for (const p of filtrados) {
      const k = `${p.classe || "Sem classe"}|${p.nivel ?? "?"}`;
      (grupos[k] = grupos[k] || []).push(p);
    }
    const ordem = Object.keys(grupos).sort((a, b) => a.split("|")[0].localeCompare(b.split("|")[0]) || (+a.split("|")[1] || 0) - (+b.split("|")[1] || 0));
    const corpo = ordem.map((k) => {
      const [classe, nivel] = k.split("|");
      return `<div class="nivel-grupo">${esc(classe)}, nível ${esc(nivel)}</div>` + grupos[k].map((p) => {
        const cor = App.corModificador(p.modificador) || "var(--linha-2)";
        const meta = [p.categoria, p.custo_mana ? `${fmt(p.custo_mana)} de mana` : null, p.dt ? `DT ${p.dt}` : null,
          p.alcance ? `alcance ${p.alcance}` : null, p.usos && p.usos !== "infinito" ? `usos ${p.usos}` : null,
          usos[p.id] ? `usado ${usos[p.id]}× nesta batalha` : null].filter(Boolean).join(" · ");
        const rolaveis = [["funcionalidade", p.teste_funcionalidade], ["acerto", p.acerto]].filter(([, t]) => t);
        return `<div class="poder" style="--cor:${cor}">
          <button class="nome-poder" type="button" data-nota="${esc(p.id)}">${esc(p.nome)}</button>
          <div class="usar">
            ${rolaveis.map(([tipo, t]) => `<button class="btn mini" type="button" data-rolar-poder="${esc(p.id)}" data-tipo="${tipo}" title="${esc(t)}">${tipo === "acerto" ? "Acerto" : "Teste"}</button>`).join("")}
            ${(p.categoria || "").toLowerCase() === "ativa" ? `<button class="btn mini ${part ? "primario" : ""}" type="button" data-usar="${esc(p.id)}" ${part ? "" : 'disabled title="Fora da batalha atual"'}>Usar</button>` : ""}
          </div>
          <div class="meta">${esc(meta)}</div>
        </div>`;
      }).join("");
    }).join("");
    return `<h2>Poderes <span class="fraco" style="font-size:16px">(${todos.length})</span></h2>
      <div class="segmentado" role="group" aria-label="Filtrar poderes" style="margin-bottom:6px">
        ${[["todos", "Todos"], ["ativa", "Ativas"], ["passiva", "Passivas"]].map(([k, r]) => `<button type="button" data-filtro="${k}" aria-pressed="${filtroPoder === k}">${r}</button>`).join("")}
      </div>
      <div class="poderes">${corpo || `<p class="sutil">Nenhum poder nesse filtro.</p>`}</div>`;
  }

  function usarPoder(ent, poder) {
    const p = participanteDe(ent.id);
    if (!p) return;
    if (p.estado === "morto") { App.aviso(`${p.nome} está fora de combate.`); return; }
    const bloqueio = p.condicoes.find((c) => CONDS_SEM_ACAO.has(c.nome));
    if (bloqueio && !App.confirmar(`${p.nome} está com ${bloqueio.nome}, que tira as ações segundo o vault. Usar mesmo assim?`)) return;
    const usados = ((App.estado.usos || {})[ent.id] || {})[poder.id] || 0;
    const lim = limiteUsos(poder.usos);
    if (lim !== null && usados >= lim && !App.confirmar(`${poder.nome} tem limite ${poder.usos} e já foi usado ${usados}× nesta batalha. Usar mesmo assim?`)) return;
    const custo = Number(poder.custo_mana);
    if (custo > 0) {
      if (!App.alterarMana(p.id, -custo, `usou ${poder.nome}`)) return;
    } else {
      App.mudar(`${p.nome} usou ${poder.nome}${poder.custo_mana ? ` (custo "${poder.custo_mana}" — ajuste a mana à mão)` : ""}.`, () => {});
    }
    App.mudar(null, (s) => {
      s.usos = s.usos || {};
      s.usos[ent.id] = s.usos[ent.id] || {};
      s.usos[ent.id][poder.id] = usados + 1;
    });
  }

  function rolarPoder(ent, poder, tipo) {
    const txt = tipo === "acerto" ? poder.acerto : poder.teste_funcionalidade;
    const opts = { vantagem: modo === "vantagem", desvantagem: modo === "desvantagem" };
    let r = R.testeEscrito(txt, opts);
    if (!r) {
      const nome = String(txt).replace(/\(.*?\)/g, "").trim();
      const n = App.buscarNota(nome);
      if (!n || n.tipo !== "pericia") { App.aviso(`Não sei rolar "${txt}".`); return; }
      r = R.testePericia(n.item, (ent.mods || {})[slug(n.item.modificador)], opts);
    }
    r.rotulo = `${poder.nome} — ${tipo === "acerto" ? "acerto" : "funcionalidade"}${poder.dt && tipo !== "acerto" ? ` (DT ${poder.dt})` : ""}`;
    App.registrarRolagem(r, ent.nome);
  }

  // ───────── Ficha ─────────
  function secaoLista(titulo, itens, fn) {
    if (!itens.length) return "";
    return `<h2 style="margin-top:22px">${titulo}</h2><div class="poderes">${itens.map(fn).join("")}</div>`;
  }

  function ficha(el, id) {
    const n = App.buscarNota(id);
    const ent = n && (n.tipo === "personagem" || n.tipo === "companheiro") ? n.item : null;
    if (!ent) { el.innerHTML = `<header class="cabeca"><h1>Ficha não encontrada</h1></header><p><a class="btn" href="#/fichas">Voltar às fichas</a></p>`; return; }
    const ehPersonagem = n.tipo === "personagem";
    const part = participanteDe(ent.id);
    const cor = App.corElemento(ent.afinidade) || "var(--texto-3)";
    const vida = part ? [part.vida, part.vidaMax] : [ent.vida_total, ent.vida_total];
    const mana = part ? [part.mana, part.manaMax] : [ent.mana_total, ent.mana_total];
    const copia = /cópia exata/i.test(ent.conteudo || "");
    const etiquetas = [
      ...lista(ent.classe).map((c) => `<a class="etiqueta wiki" data-nota="${esc(c)}">${esc(c)}</a>`),
      ...lista(ent.linhagem).map((c) => `<a class="etiqueta wiki" data-nota="${esc(c)}">${esc(c)}</a>`),
      ent.afinidade ? `<a class="etiqueta el wiki" style="--cor:${cor}" data-nota="${esc(ent.afinidade)}">Afinidade ${esc(ent.afinidade)}</a>` : "",
      ent.jogador ? `<span class="etiqueta">Jogador: ${esc(ent.jogador)}</span>` : "",
    ].join("");

    const pips = (usados, max, campo, maxCampo, classe) => max ? `<span class="pips ${classe}">${Array.from({ length: max }, (_, i) =>
      `<button class="pip ${i < usados ? "usado" : ""}" type="button" ${part ? `data-contador="${campo}" data-max="${maxCampo}" data-i="${i}"` : "disabled"} aria-label="${i + 1} de ${max}"></button>`).join("")}</span>` : "—";

    const contadores = ehPersonagem ? `<div class="contadores">
      <span>Morrer ${pips(part ? part.morrerUsados : 0, part ? part.morrerMax : ent.morrer, "morrerUsados", "morrerMax", "morrer")}</span>
      <span>Predestinação ${pips(part ? part.predUsados : 0, part ? part.predMax : ent.predestinacao, "predUsados", "predMax", "pred")}</span>
      ${ent.nivel !== undefined ? `<span>Nível <b>${ent.nivel}</b></span>` : ""}
      ${ent.xp ? `<span>XP <b>${esc(ent.xp)}</b></span>` : ""}
      ${ent.movimentacao ? `<span>Movimentação <b>${esc(String(ent.movimentacao).replace(/\s*passos?$/i, ""))}</b> passos</span>` : ""}
      ${ent.pods ? `<span>Pods <b>${esc(ent.pods)}</b></span>` : ""}
      ${ent.invocacoes ? `<span>Invocações <b>${esc(ent.invocacoes)}</b></span>` : ""}
      ${ent.ether !== undefined ? `<span>Ether <b>${esc(ent.ether)}</b></span>` : ""}
      ${ent.plasma !== undefined ? `<span>Plasma <b>${esc(ent.plasma)}</b></span>` : ""}
      ${ent.inspiracao !== undefined ? `<span>Inspiração <b>${esc(ent.inspiracao)}</b></span>` : ""}
    </div>` : "";

    const avisos = [
      copia ? `<div class="aviso-dados"><span class="selo-conflito">Conflito</span><div>A aba deste personagem na planilha é cópia da aba de outra pessoa. Os poderes mostrados podem não ser dele. Detalhes na <a class="wiki" data-nota="${esc(ent.id)}">nota do vault</a>.</div></div>` : "",
      ehPersonagem && !ent.mods ? `<div class="aviso-dados"><span class="selo-duvida">Falta dado</span><div>Os modificadores deste personagem não estão no vault. Preencha as propriedades (agilidade, precisao, forca…) na nota do Obsidian e gere os dados de novo.</div></div>` : "",
    ].join("");

    const itens = D.itens.filter((i) => lista(i.portador).includes(ent.id));
    const invoc = D.invocacoes.filter((i) => i.dono === ent.id);
    const especiais = D.periciasEspeciais.filter((p) => p.personagem === ent.id);
    const afins = D.afinidades.filter((a) => ent.afinidade && a.elemento === ent.afinidade);

    el.innerHTML = `
      <p style="margin:0 0 14px"><a class="btn fantasma mini" href="#/fichas">← Fichas</a></p>
      <section class="ficha-topo">
        <div class="moldura" style="--anel:${cor}">${ent.retrato ? `<img src="${ent.retrato}" alt="Retrato de ${esc(ent.nome)}">` : `<span class="sem-retrato">${esc(App.iniciais(ent.nome))}</span>`}</div>
        <div>
          <h1 class="ficha-nome">${ent.emblema ? `<img class="emblema" src="${ent.emblema}" alt="Emblema de ${esc(ent.nome)}">` : ""}${esc(ent.nome)}</h1>
          <p class="ficha-sub">${esc(ent.nome_completo || (ehPersonagem ? "" : "Companheiro"))}${ent.idade ? `${ent.nome_completo ? ", " : ""}${ent.idade} anos` : ""}${ent.nivel && !ehPersonagem ? `, nível ${ent.nivel}` : ""}</p>
          <div class="etiquetas">${etiquetas}</div>
          <div class="recursos">
            <div>${App.htmlBarra(vida[0], vida[1], "vida").replace("barra ", "barra alta ")}</div>
            ${mana[1] ? `<div>${App.htmlBarra(mana[0], mana[1], "mana").replace("barra mana", "barra alta mana")}</div>` : ""}
          </div>
          ${part && part.condicoes.length ? `<div class="chips" style="margin-top:10px">${part.condicoes.map((c) => `<a class="chip wiki" data-nota="${esc(c.nome)}">${esc(c.nome)}${c.estagio ? " " + esc(c.estagio) : ""}</a>`).join("")}</div>` : ""}
          ${contadores}
          <p class="sutil" style="margin:12px 0 0;font-size:14px">${part ? `Na batalha ${esc(App.estado.batalha.titulo)}: valores ao vivo da mesa.` : "Fora da batalha atual: mostrando os valores totais."}
            <button class="btn mini fantasma" type="button" data-nota="${esc(ent.id)}">Nota completa</button></p>
        </div>
      </section>
      ${avisos}
      ${ehPersonagem ? `<h2>Modificadores</h2>${anel(ent)}${resistencias(ent)}` : ""}
      <div class="secoes-ficha" style="margin-top:26px">
        <div>${ehPersonagem ? htmlPoderes(ent) : `<div class="nota">${App.markdown(ent.conteudo || "")}</div>`}</div>
        <div>
          ${secaoLista("Afinidade", afins, (a) => `<div class="poder" style="--cor:${cor}"><button class="nome-poder" type="button" data-nota="${esc(a.id)}">${esc(a.nome)}</button><div class="meta">${esc(a.usos ? "usos " + a.usos : "")}</div></div>`)}
          ${secaoLista("Perícias da ficha", especiais, (p) => `<div class="poder"><button class="nome-poder" type="button" data-nota="${esc(p.id)}">${esc(p.nome)}</button><div class="meta">${esc([p.categoria, p.custo_mana ? fmt(p.custo_mana) + " de mana" : null, p.usos ? "usos " + p.usos : null].filter(Boolean).join(" · "))}</div></div>`)}
          ${secaoLista("Itens", itens, (i) => `<div class="poder"><button class="nome-poder" type="button" data-nota="${esc(i.id)}">${esc(i.nome)}</button><div class="meta">${esc([i.categoria, i.dano ? "dano " + i.dano : null, i.raridade].filter(Boolean).join(" · "))}</div></div>`)}
          ${secaoLista("Invocações", invoc, (i) => `<div class="poder"><button class="nome-poder" type="button" data-nota="${esc(i.id)}">${esc(i.nome)}</button><div class="meta">${esc([i.categoria, i.vida_total ? i.vida_total + " de vida" : null].filter(Boolean).join(" · "))}</div></div>`)}
        </div>
      </div>`;

    // Interações
    el.querySelectorAll("[data-mod]").forEach((b) => b.addEventListener("click", () => { selecionado[ent.id] = b.dataset.mod; ficha(el, id); }));
    el.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.modo; ficha(el, id); }));
    el.querySelectorAll("[data-filtro]").forEach((b) => b.addEventListener("click", () => { filtroPoder = b.dataset.filtro; ficha(el, id); }));
    el.querySelectorAll("button[data-nota]").forEach((b) => b.addEventListener("click", () => App.abrirNota(b.dataset.nota)));
    el.querySelectorAll("[data-pericia]").forEach((b) => b.addEventListener("click", () => {
      const p = idx.pericia[b.dataset.pericia];
      const r = R.testePericia(p, (ent.mods || {})[slug(p.modificador)], { vantagem: modo === "vantagem", desvantagem: modo === "desvantagem" });
      if (modo !== "normal" && !r.erro) r.rotulo += ` com ${modo}`;
      App.registrarRolagem(r, ent.nome);
    }));
    el.querySelectorAll("[data-usar]").forEach((b) => b.addEventListener("click", () => usarPoder(ent, idx.poder[b.dataset.usar])));
    el.querySelectorAll("[data-rolar-poder]").forEach((b) => b.addEventListener("click", () => rolarPoder(ent, idx.poder[b.dataset.rolarPoder], b.dataset.tipo)));
    el.querySelectorAll("[data-contador]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i;
      const atual = part[b.dataset.contador];
      App.marcarContador(part.id, b.dataset.contador, b.dataset.max, i < atual ? i : i + 1);
    }));
  }

  App.vistas.fichas = { render: galeria };
  App.vistas.ficha = { render: ficha };
})();
