/* Mesa: visão geral da batalha em andamento. */
(function () {
  "use strict";
  const { esc, fmt, hora } = App;

  function barra(atual, max, tipo) {
    if (max === null || max === undefined || atual === null || atual === undefined)
      return `<div class="valor-barra"><span>${tipo === "mana" ? "Mana" : "Vida"}</span><span class="fraco">não cadastrada</span></div>`;
    const pct = Math.max(0, Math.min(100, (atual / max) * 100));
    return `<div class="valor-barra"><span>${tipo === "mana" ? "Mana" : "Vida"}</span><span><b>${fmt(atual)}</b> / ${fmt(max)}</span></div>
      <div class="barra ${tipo === "mana" ? "mana" : ""} ${atual > max ? "acima" : ""}"><i style="width:${pct}%"></i></div>`;
  }
  App.htmlBarra = barra;

  function membro(p) {
    const e = App.entidade(p);
    const href = p.ref && p.ref.tipo === "personagem" ? `#/ficha/${encodeURIComponent(p.ref.id)}` : "#/mestre";
    return `<a class="membro" href="${href}">
      ${App.htmlRetrato(p)}
      <div><div class="nome">${esc(p.nome)}</div><div class="sutil" style="font-size:14px">${esc(p.estado === "morto" ? "Fora de combate" : (e?.classe ? [].concat(e.classe).join(" e ") : p.tipo.toLowerCase()))}</div></div>
      <div class="barras">${barra(p.vida, p.vidaMax, "vida")}${p.manaMax ? barra(p.mana, p.manaMax, "mana") : ""}
        ${p.condicoes.length ? `<div class="chips">${p.condicoes.map((c) => `<span class="chip">${esc(c.nome)}${c.estagio ? " " + esc(c.estagio) : ""}</span>`).join("")}</div>` : ""}
      </div>
    </a>`;
  }

  App.vistas.inicio = {
    render(el) {
      const s = App.estado;
      const b = s.batalha;
      const ps = App.participantes();
      const vez = App.part(b.vez);
      const data = b.data ? new Date(b.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : null;
      const boss = ps.find((p) => p.tipo === "BOSS");
      const aliados = ps.filter((p) => p.lado === "aliado");
      const inimigos = ps.filter((p) => p.lado !== "aliado");
      el.innerHTML = `
        <header class="cabeca">
          <div>
            <h1>${esc(b.titulo)}</h1>
            <p>${data ? `Batalha de ${esc(data)}` : "Batalha em andamento"}${boss ? `, contra ${esc(boss.nome)}` : ""}.</p>
          </div>
          <div class="acoes"><a class="btn" href="#/mapa">Abrir mapa</a><a class="btn primario" href="#/mestre">Conduzir batalha</a></div>
        </header>

        <section class="faixa-batalha" aria-label="Turno">
          <div><div class="sutil">Turno da batalha</div><div class="contador">${fmt(b.turno)}${b.turnosTotal ? ` <small>de ${fmt(b.turnosTotal)}</small>` : ""}</div></div>
          ${vez ? `<div style="display:flex;gap:12px;align-items:center">${App.htmlRetrato(vez, "g")}<div><div class="sutil">Vez de</div><div class="titulo">${esc(vez.nome)}</div></div></div>` : ""}
          <div class="sutil">${aliados.length} aliados e ${inimigos.length} inimigos na mesa</div>
        </section>

        <div class="grade-2">
          <div>
            <h2>Grupo</h2>
            <div class="lista-grupo">${aliados.map(membro).join("")}</div>
            <h2 style="margin-top:26px">Inimigos</h2>
            <div class="lista-grupo">${inimigos.map(membro).join("") || `<p class="sutil">Nenhum inimigo na mesa. Adicione pelo painel do mestre.</p>`}</div>
          </div>
          <aside class="painel">
            <h2>Registro</h2>
            <ul class="registro">${s.log.slice().reverse().slice(0, 14).map((l) => `<li><time>${hora(l.t)}</time><span class="${l.auto ? "auto" : ""}">${esc(l.texto)}</span></li>`).join("")}</ul>
            <p style="margin:12px 0 0"><a class="btn mini" href="#/mestre">Ver registro completo</a></p>
          </aside>
        </div>`;
    },
  };
})();
