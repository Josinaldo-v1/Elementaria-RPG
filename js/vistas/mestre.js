/* Painel do mestre: ordem, turnos, vida, mana, condições, correções e registro. */
(function () {
  "use strict";
  const { esc, fmt, D, hora, slug } = App;
  const R = window.Regras;
  const TIPOS = ["PLAYER", "ALIADO", "INIMIGO", "MINI BOSS", "BOSS"];

  const pips = (p, campo, maxCampo, classe, rotulo) => p[maxCampo] ? `<span class="pips ${classe}" title="${rotulo} ${p[campo]}/${p[maxCampo]}">${Array.from({ length: p[maxCampo] }, (_, i) =>
    `<button class="pip ${i < p[campo] ? "usado" : ""}" type="button" data-contador="${campo}" data-max="${maxCampo}" data-id="${p.id}" data-i="${i}" aria-label="${rotulo} ${i + 1} de ${p[maxCampo]}"></button>`).join("")}</span>` : "";

  function linha(p, vez) {
    return `<div class="linha-comb ${p.id === vez ? "ativo" : ""} ${p.estado === "morto" ? "morto" : ""}" data-linha="${p.id}">
      <div class="ordem">
        <button type="button" data-mover="-1" data-id="${p.id}" aria-label="Subir na ordem">▲</button>${p.ordem}<button type="button" data-mover="1" data-id="${p.id}" aria-label="Descer na ordem">▼</button>
      </div>
      <button type="button" class="btn fantasma" style="padding:0;border-radius:50%" data-vez="${p.id}" title="Marcar como a vez de ${esc(p.nome)}">${App.htmlRetrato(p)}</button>
      <div class="quem">
        <b><button type="button" class="btn fantasma" style="padding:0;font-weight:700;border-radius:4px" data-editar="${p.id}">${esc(p.nome)}</button></b>
        <span><span class="tipo ${slug(p.tipo).replace("_", "-")}">${esc(p.tipo.toLowerCase())}</span>${p.estado === "morto" ? "fora de combate" : ""}${p.acaoLendaria ? " · ação lendária" : ""}</span>
        <div style="display:flex;gap:10px;margin-top:4px">${pips(p, "morrerUsados", "morrerMax", "morrer", "Morrer")}${pips(p, "predUsados", "predMax", "pred", "Predestinação")}</div>
      </div>
      <div>${App.htmlBarra(p.vida, p.vidaMax, "vida")}</div>
      <div>${p.manaMax ? App.htmlBarra(p.mana, p.manaMax, "mana") : `<span class="fraco" style="font-size:14px">Sem mana</span>`}</div>
      <div class="conds"><div class="chips">${p.condicoes.map((c) => `<span class="chip"><a class="wiki" data-nota="${esc(c.nome)}" style="text-decoration:none">${esc(c.nome)}${c.estagio ? " " + esc(c.estagio) : ""}</a><button type="button" data-tirar-cond="${esc(c.nome)}" data-id="${p.id}" aria-label="Remover ${esc(c.nome)}">×</button></span>`).join("")}
        <button class="btn mini fantasma" type="button" data-add-cond="${p.id}">+ condição</button></div></div>
      <div class="acao-rapida">
        <label class="visualmente-oculto" for="q-${p.id}">Valor para ${esc(p.nome)}</label>
        <input id="q-${p.id}" type="number" min="0" inputmode="numeric" placeholder="valor">
        <button class="btn mini" type="button" data-rapida="dano" data-id="${p.id}">Dano</button>
        <button class="btn mini" type="button" data-rapida="cura" data-id="${p.id}">Cura</button>
        ${p.manaMax ? `<button class="btn mini" type="button" data-rapida="mana-" data-id="${p.id}" title="Gastar mana">−Mana</button><button class="btn mini" type="button" data-rapida="mana+" data-id="${p.id}" title="Recuperar mana">+Mana</button>` : ""}
        <button class="btn mini fantasma" type="button" data-editar="${p.id}">Editar</button>
      </div>
    </div>`;
  }

  // ───────── Turnos ─────────
  function passarVez() {
    const ps = App.participantes().filter((p) => p.estado !== "morto");
    if (!ps.length) return;
    const b = App.estado.batalha;
    const i = ps.findIndex((p) => p.id === b.vez);
    const prox = ps[(i + 1) % ps.length];
    const virou = i === ps.length - 1;   // voltou ao primeiro da ordem → novo turno da batalha
    App.mudar(null, (s) => {
      if (virou) {
        s.batalha.turno += 1;
        App.registrar(`Turno ${s.batalha.turno} da batalha começou.`, true);
      }
      s.batalha.vez = prox.id;
      App.registrar(`Vez de ${prox.nome}.`, true);
      if (prox.condicoes.length) App.registrar(`Lembrete: ${prox.nome} está com ${prox.condicoes.map((c) => c.nome + (c.estagio ? " " + c.estagio : "")).join(", ")} — confira o efeito da condição.`, true);
    });
  }

  function moverOrdem(id, dir) {
    const ps = App.participantes();
    const i = ps.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= ps.length) return;
    App.mudar(`Ordem: ${ps[i].nome} ${dir < 0 ? "subiu" : "desceu"} para ${j + 1}º.`, () => {
      [ps[i], ps[j]] = [ps[j], ps[i]];
      ps.forEach((p, k) => { p.ordem = k + 1; });
    });
  }

  // ───────── Iniciativa (Xd100 em Energia) ─────────
  function rolarIniciativa() {
    const ps = App.participantes();
    const linhas = ps.map((p) => {
      const e = App.entidade(p);
      const energia = e && e.mods ? e.mods.energia : undefined;
      const r = energia !== undefined ? R.testeXd(energia, 100) : null;
      return { p, energia, r };
    });
    const html = `<p class="sutil">Regra do vault: iniciativa é <b>Xd100 em Energia</b> (1 d100 + 1 a cada 4 pontos); empate desempata pelo valor de Energia. Quem não tem Energia na ficha recebe o valor à mão.</p>
      <form class="form-ini"><div class="poderes">${linhas.map(({ p, energia, r }) => `<div class="poder">
        <div><b>${esc(p.nome)}</b><div class="meta">${energia !== undefined ? `Energia ${energia}: ${r.expressao} → ${r.valores.join(", ")}` : "Sem Energia na ficha"}</div></div>
        <div class="usar"><label class="visualmente-oculto" for="ini-${p.id}">Iniciativa de ${esc(p.nome)}</label><input id="ini-${p.id}" type="number" data-ini="${p.id}" data-mod="${energia ?? ""}" value="${r ? r.total : ""}" placeholder="—"></div></div>`).join("")}</div>
        <p class="sutil" style="font-size:14px">O resultado mostrado é o maior d100 — o vault ainda marca como dúvida se é o maior dado.</p>
        <p><button class="btn primario" type="submit">Aplicar ordem</button></p></form>`;
    App.abrirGaveta("Rolar iniciativa", html, (corpo) => {
      corpo.querySelector(".form-ini").addEventListener("submit", (e) => {
        e.preventDefault();
        const com = [], sem = [];
        corpo.querySelectorAll("[data-ini]").forEach((inp) => {
          const p = App.part(inp.dataset.ini);
          if (inp.value === "") sem.push(p);
          else com.push({ id: p.id, resultado: +inp.value, mod: inp.dataset.mod === "" ? 0 : +inp.dataset.mod });
        });
        const ordem = R.ordenarIniciativa(com).map((x) => App.part(x.id)).concat(sem);
        App.mudar(`Iniciativa aplicada: ${ordem.map((p) => p.nome).join(", ")}.`, (s) => {
          ordem.forEach((p, k) => { p.ordem = k + 1; });
          s.batalha.vez = ordem.find((p) => p.estado !== "morto")?.id || null;
        });
        App.fecharGaveta();
      });
    });
  }

  // ───────── Condições ─────────
  function gavetaCondicao(id) {
    const p = App.part(id);
    const html = `<form class="form-cond">
      <label class="campo">Condição<select name="cond">${D.condicoes.map((c) => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}</select></label>
      <label class="campo" style="margin-top:10px">Estágio<select name="est"></select></label>
      <p style="margin-top:14px"><button class="btn primario" type="submit">Aplicar em ${esc(p.nome)}</button></p>
      <div class="nota previa"></div></form>`;
    App.abrirGaveta("Aplicar condição", html, (corpo) => {
      const sel = corpo.querySelector("[name=cond]");
      const est = corpo.querySelector("[name=est]");
      const previa = () => {
        const c = App.idx.condicao[sel.value] || D.condicoes.find((x) => x.nome === sel.value);
        const estagios = (c.estagios || []).filter((x) => x !== "Único" && x !== "?");
        est.innerHTML = estagios.length ? estagios.map((x) => `<option>${x}</option>`).join("") : `<option value="">Único</option>`;
        est.disabled = !estagios.length;
        corpo.querySelector(".previa").innerHTML = App.markdown(c.conteudo || "");
      };
      sel.addEventListener("change", previa);
      previa();
      corpo.querySelector(".form-cond").addEventListener("submit", (e) => {
        e.preventDefault();
        App.adicionarCondicao(id, sel.value, est.value || null);
        App.fecharGaveta();
      });
    });
  }

  // ───────── Correções (edição completa) ─────────
  const CAMPOS = [["nome", "Nome", "text"], ["ordem", "Ordem", "number"], ["vida", "Vida atual", "number"], ["vidaMax", "Vida total", "number"],
    ["mana", "Mana atual", "number"], ["manaMax", "Mana total", "number"], ["morrerUsados", "Morrer usados", "number"], ["morrerMax", "Morrer (total)", "number"],
    ["predUsados", "Predestinação usada", "number"], ["predMax", "Predestinação (total)", "number"], ["tam", "Tamanho no mapa (quadrados)", "number"]];
  function gavetaEditar(id) {
    const p = App.part(id);
    const html = `<form class="form-edit">
      <p class="sutil">Tudo aqui é correção manual do mestre e vai para o registro com o valor antigo e o novo.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${CAMPOS.map(([k, r, t]) => `<label class="campo" ${k === "nome" ? 'style="grid-column:1/-1"' : ""}>${r}<input name="${k}" type="${t}" value="${p[k] ?? ""}" ${t === "number" ? 'style="width:100%"' : ""}></label>`).join("")}
        <label class="campo">Tipo<select name="tipo">${TIPOS.map((t) => `<option ${t === p.tipo ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="campo">Situação<select name="estado"><option value="ativo" ${p.estado !== "morto" ? "selected" : ""}>Em combate</option><option value="morto" ${p.estado === "morto" ? "selected" : ""}>Fora de combate</option></select></label>
        <label class="campo" style="flex-direction:row;align-items:center;gap:8px;grid-column:1/-1"><input type="checkbox" name="acaoLendaria" ${p.acaoLendaria ? "checked" : ""}> Ação lendária (a regra ainda não está no vault)</label>
        <label class="campo" style="grid-column:1/-1">Notas do mestre<textarea name="notas">${esc(p.notas || "")}</textarea></label>
      </div>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn primario" type="submit">Salvar correções</button>
        ${p.ref ? `<button class="btn" type="button" data-nota="${esc(p.ref.id)}">Ver nota do vault</button>` : ""}
        <button class="btn perigo" type="button" data-remover>Remover da batalha</button></p>
    </form>`;
    App.abrirGaveta(`Editar ${p.nome}`, html, (corpo) => {
      corpo.querySelector("[data-nota]")?.addEventListener("click", (e) => App.abrirNota(e.target.dataset.nota));
      corpo.querySelector("[data-remover]").addEventListener("click", () => {
        if (!App.confirmar(`Remover ${p.nome} da batalha?`)) return;
        App.mudar(`${p.nome} foi removido da batalha.`, (s) => { s.participantes = s.participantes.filter((x) => x.id !== id); if (s.batalha.vez === id) s.batalha.vez = null; });
        App.fecharGaveta();
      });
      corpo.querySelector(".form-edit").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const mudancas = [];
        const novo = {};
        for (const [k, r, t] of CAMPOS) {
          const bruto = f.get(k);
          const v = t === "number" ? (bruto === "" ? null : Number(bruto)) : String(bruto).trim();
          if (v !== (p[k] ?? null) && !(t === "text" && v === p[k])) { novo[k] = v; mudancas.push(`${r} ${p[k] ?? "—"} → ${v ?? "—"}`); }
        }
        for (const k of ["tipo", "estado"]) if (f.get(k) !== p[k]) { novo[k] = f.get(k); mudancas.push(`${k} ${p[k]} → ${f.get(k)}`); }
        const al = f.get("acaoLendaria") === "on";
        if (al !== !!p.acaoLendaria) { novo.acaoLendaria = al; mudancas.push(`ação lendária ${al ? "marcada" : "desmarcada"}`); }
        if ((f.get("notas") || "") !== (p.notas || "")) { novo.notas = f.get("notas"); mudancas.push("notas"); }
        if (!mudancas.length) { App.fecharGaveta(); return; }
        App.mudar(`Mestre corrigiu ${p.nome}: ${mudancas.join("; ")}.`, () => {
          const antes = JSON.parse(JSON.stringify(p));
          Object.assign(p, novo);
          if (novo.tipo) p.lado = App.ladoDoTipo(novo.tipo);
          for (const c of R.consequencias(antes, p)) {
            if (c.tipo === "condicao" && !p.condicoes.some((x) => x.nome === c.nome)) { p.condicoes.push({ nome: c.nome, estagio: null, desde: App.estado.batalha.turno }); App.registrar(`${p.nome} recebeu ${c.nome} (${c.motivo} — regra: ${c.fonte}).`, true); }
            if (c.tipo === "estado") { p.estado = c.nome; App.registrar(`${p.nome}: ${c.motivo}.`, true); }
          }
        });
        App.fecharGaveta();
      });
    });
  }

  // ───────── Adicionar combatente ─────────
  function gavetaAdicionar() {
    const grupos = [["Personagens", "personagem", D.personagens], ["Companheiros", "companheiro", D.companheiros], ["Invocações", "invocacao", D.invocacoes],
      ["Inimigos", "inimigo", D.inimigos], ["NPCs", "npc", D.npcs]];
    const naMesa = new Set(App.estado.participantes.map((p) => p.ref && p.ref.id));
    const html = `<form class="form-livre painel" style="margin-bottom:16px">
        <h3>Combatente livre</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label class="campo" style="grid-column:1/-1">Nome<input name="nome" type="text" required placeholder="Ex.: Aranha rápida 2"></label>
          <label class="campo">Tipo<select name="tipo">${TIPOS.map((t) => `<option ${t === "INIMIGO" ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label class="campo">Vida<input name="vida" type="number" style="width:100%"></label>
          <label class="campo">Mana<input name="mana" type="number" style="width:100%"></label>
        </div>
        <p style="margin:10px 0 0"><button class="btn primario" type="submit">Adicionar</button></p>
      </form>
      <label class="campo">Buscar no vault<input type="search" class="busca" placeholder="Nome de personagem, inimigo, NPC…"></label>
      <div class="resultados" style="margin-top:10px">${grupos.map(([titulo, tipo, lista]) => `<h3 style="margin-top:14px">${titulo}</h3><div class="poderes">${lista.map((it) =>
        `<div class="poder" data-busca="${esc(slug(it.nome + " " + (it.classe || "") + " " + (it.categoria || "")))}"><div><b>${esc(it.nome)}</b>${it.soMestre ? ` <span class="selo-conflito">só mestre</span>` : ""}<div class="meta">${esc([].concat(it.classe || it.categoria || []).join(", "))}${it.vida_total ? ` · ${fmt(it.vida_total)} de vida` : ""}</div></div>
          <div class="usar"><button class="btn mini" type="button" data-add-tipo="${tipo}" data-add-id="${esc(it.id)}">${naMesa.has(it.id) ? "Adicionar outro" : "Adicionar"}</button></div></div>`).join("")}</div>`).join("")}</div>`;
    App.abrirGaveta("Adicionar combatente", html, (corpo) => {
      const proxOrdem = () => Math.max(0, ...App.estado.participantes.map((p) => p.ordem)) + 1;
      corpo.querySelector(".busca").addEventListener("input", (e) => {
        const q = slug(e.target.value);
        corpo.querySelectorAll("[data-busca]").forEach((d) => { d.hidden = q && !d.dataset.busca.includes(q); });
      });
      corpo.querySelectorAll("[data-add-id]").forEach((b) => b.addEventListener("click", () => {
        const ent = App.idx[b.dataset.addTipo][b.dataset.addId];
        const novo = App.novoParticipante({ nome: ent.nome, ref: { tipo: b.dataset.addTipo, id: ent.id }, ordem: proxOrdem() });
        App.mudar(`${novo.nome} entrou na batalha (${novo.tipo.toLowerCase()}).`, (s) => { s.participantes.push(novo); if (!s.batalha.vez) s.batalha.vez = novo.id; });
        App.aviso(`${novo.nome} adicionado.`);
      }));
      corpo.querySelector(".form-livre").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const num = (k) => (f.get(k) === "" ? null : Number(f.get(k)));
        const novo = App.novoParticipante({ nome: f.get("nome").trim(), ref: null, tipo: f.get("tipo"), vidaMax: num("vida"), vida: num("vida"), manaMax: num("mana"), mana: num("mana"), ordem: proxOrdem() });
        App.mudar(`${novo.nome} entrou na batalha (${novo.tipo.toLowerCase()}).`, (s) => { s.participantes.push(novo); if (!s.batalha.vez) s.batalha.vez = novo.id; });
        e.target.reset();
        App.aviso(`${novo.nome} adicionado.`);
      });
    });
  }

  // ───────── Backup ─────────
  function exportar() {
    const blob = new Blob([JSON.stringify(App.estado, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mesa-${slug(App.estado.batalha.titulo)}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importar(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const s = JSON.parse(leitor.result);
        if (!s.participantes || !s.batalha) throw new Error("formato");
        if (!App.confirmar(`Substituir a mesa atual por "${s.batalha.titulo}" (${s.participantes.length} combatentes)?`)) return;
        App.mudar(null, () => { Object.keys(App.estado).forEach((k) => delete App.estado[k]); Object.assign(App.estado, s); });
        App.mudar(`Mesa importada de ${arquivo.name}.`, () => {});
      } catch (e) { App.aviso("Esse arquivo não é um backup da mesa."); }
    };
    leitor.readAsText(arquivo);
  }

  // ───────── Vista ─────────
  function render(el) {
    if (!App.mestre) {
      el.innerHTML = `
        <header class="cabeca"><div><h1>Painel do mestre</h1><p>Esta aba está na visão do jogador.</p></div></header>
        <section class="painel" style="max-width:560px">
          <p style="margin-top:0">O painel do mestre mostra inimigos, NPCs e notas que os jogadores não devem ver. Entre na visão do mestre só nesta aba, com a tela longe dos jogadores. As outras abas, como o mapa na TV, continuam na visão do jogador.</p>
          <p style="margin-bottom:0"><button class="btn primario" type="button" data-entrar>Entrar na visão do mestre</button></p>
        </section>`;
      el.querySelector("[data-entrar]").addEventListener("click", () => App.trocarVisao(true));
      return;
    }
    const s = App.estado;
    const b = s.batalha;
    const vez = App.part(b.vez);
    el.innerHTML = `
      <header class="cabeca">
        <div><h1>Painel do mestre</h1><p>${esc(b.titulo)}. Toda mudança vai para o registro e pode ser desfeita (Ctrl+Z).</p></div>
        <div class="acoes">
          <button class="btn" type="button" data-acao="desfazer" ${App.podeDesfazer() ? "" : "disabled"}>Desfazer</button>
          <button class="btn" type="button" data-acao="adicionar">Adicionar combatente</button>
        </div>
      </header>
      <div class="barra-turno">
        <div><div class="sutil" style="font-size:14px">Turno da batalha</div>
          <div style="display:flex;align-items:center;gap:8px"><button class="btn mini fantasma" type="button" data-acao="turno-" aria-label="Voltar um turno">−</button><span class="grande">${fmt(b.turno)}</span><button class="btn mini fantasma" type="button" data-acao="turno+" aria-label="Avançar um turno">+</button>
          <span class="sutil">de</span><label class="visualmente-oculto" for="tt">Total de turnos</label><input id="tt" type="number" value="${b.turnosTotal ?? ""}" style="width:70px" data-acao="total"></div></div>
        <div style="display:flex;align-items:center;gap:10px">${vez ? App.htmlRetrato(vez) + `<div><div class="sutil" style="font-size:14px">Vez de</div><b>${esc(vez.nome)}</b></div>` : `<span class="sutil">Ninguém na vez</span>`}</div>
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" type="button" data-acao="iniciativa">Rolar iniciativa</button>
          <button class="btn primario" type="button" data-acao="passar" title="Atalho: N">Passar a vez</button>
        </div>
      </div>
      <div class="grade-2">
        <div class="rastreador">${App.participantes().map((p) => linha(p, b.vez)).join("") || `<p class="sutil">Mesa vazia. Use "Adicionar combatente".</p>`}</div>
        <aside class="painel">
          <h2>Registro</h2>
          <ul class="registro registro-mestre">${s.log.slice().reverse().map((l) => `<li><time>${hora(l.t)}</time><span class="${l.auto ? "auto" : ""}">${esc(l.texto)}</span></li>`).join("")}</ul>
          <h3 style="margin-top:18px">Mesa</h3>
          <p style="display:flex;gap:6px;flex-wrap:wrap;margin:0">
            <button class="btn mini" type="button" data-acao="exportar">Exportar backup</button>
            <label class="btn mini">Importar backup<input type="file" accept="application/json" data-acao="importar" hidden></label>
            <button class="btn mini perigo" type="button" data-acao="restaurar">Recarregar do vault</button>
          </p>
          <p class="fraco" style="font-size:13px;margin:10px 0 0">A mesa fica salva neste navegador. Abra o mapa em outra aba ou na TV: as mudanças aparecem nas duas.</p>
        </aside>
      </div>`;

    const on = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", (e) => fn(x, e)));
    on('[data-acao="desfazer"]', () => App.desfazer());
    on('[data-acao="adicionar"]', gavetaAdicionar);
    on('[data-acao="passar"]', passarVez);
    on('[data-acao="iniciativa"]', rolarIniciativa);
    on('[data-acao="exportar"]', exportar);
    on('[data-acao="restaurar"]', () => { if (App.confirmar("Descartar a mesa atual e recarregar a batalha salva no vault? (dá para desfazer)")) App.reiniciar(); });
    el.querySelector('[data-acao="importar"]').addEventListener("change", (e) => e.target.files[0] && importar(e.target.files[0]));
    on('[data-acao="turno-"]', () => App.mudar(`Mestre voltou para o turno ${b.turno - 1}.`, (s) => { s.batalha.turno = Math.max(1, s.batalha.turno - 1); }));
    on('[data-acao="turno+"]', () => App.mudar(`Turno ${b.turno + 1} da batalha começou.`, (s) => { s.batalha.turno += 1; }, { auto: true }));
    el.querySelector('[data-acao="total"]').addEventListener("change", (e) => App.mudar(`Total de turnos: ${e.target.value || "—"}.`, (s) => { s.batalha.turnosTotal = e.target.value === "" ? null : +e.target.value; }));
    on("[data-mover]", (x) => moverOrdem(x.dataset.id, +x.dataset.mover));
    on("[data-vez]", (x) => { const p = App.part(x.dataset.vez); App.mudar(`Vez de ${p.nome} (definida pelo mestre).`, (s) => { s.batalha.vez = p.id; }); });
    on("[data-editar]", (x) => gavetaEditar(x.dataset.editar));
    on("[data-add-cond]", (x) => gavetaCondicao(x.dataset.addCond));
    on("[data-tirar-cond]", (x) => App.removerCondicao(x.dataset.id, x.dataset.tirarCond));
    on("[data-contador]", (x) => {
      const p = App.part(x.dataset.id);
      const i = +x.dataset.i;
      App.marcarContador(p.id, x.dataset.contador, x.dataset.max, i < p[x.dataset.contador] ? i : i + 1);
    });
    on("[data-rapida]", (x) => {
      const inp = el.querySelector(`#q-${x.dataset.id}`);
      const v = Math.abs(parseInt(inp.value, 10));
      if (!v) { inp.focus(); App.aviso("Digite um valor primeiro."); return; }
      const acao = x.dataset.rapida;
      if (acao === "dano") App.alterarVida(x.dataset.id, -v);
      else if (acao === "cura") App.alterarVida(x.dataset.id, v);
      else if (acao === "mana-") App.alterarMana(x.dataset.id, -v);
      else App.alterarMana(x.dataset.id, v);
    });
    el.querySelectorAll(".acao-rapida input").forEach((inp) => inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); inp.parentElement.querySelector('[data-rapida="dano"]').click(); }
    }));
  }

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (location.hash.startsWith("#/mestre") && e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) passarVez();
  });

  App.vistas.mestre = { render };
})();
