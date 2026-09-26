/* Mapa tático: imagem, grade, tokens, régua e áreas. */
(function () {
  "use strict";
  const { esc, fmt } = App;

  // ───────── Imagem do mapa no IndexedDB (grande demais para o localStorage) ─────────
  const BD = {
    abrir() {
      return new Promise((ok, erro) => {
        const r = indexedDB.open("elementaria", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("arquivos");
        r.onsuccess = () => ok(r.result);
        r.onerror = () => erro(r.error);
      });
    },
    async op(modo, fn) {
      const db = await this.abrir();
      return new Promise((ok, erro) => {
        const tx = db.transaction("arquivos", modo);
        const req = fn(tx.objectStore("arquivos"));
        tx.oncomplete = () => ok(req && req.result);
        tx.onerror = () => erro(tx.error);
      });
    },
    salvar: (blob) => BD.op("readwrite", (s) => s.put(blob, "mapa")),
    ler: () => BD.op("readonly", (s) => s.get("mapa")),
    apagar: () => BD.op("readwrite", (s) => s.delete("mapa")),
  };

  // ───────── Estado local da tela (não vai para a mesa) ─────────
  const ui = { sel: null, ferramenta: "mover", forma: "circulo", tamanho: 3, abertura: 90, regua: null, area: null, hover: null, urlImagem: null, arrasto: null, ponteiros: new Map() };
  let el = null;
  let salvarVistaT = null;

  const M = () => App.estado.mapa;
  const letra = (c) => { let s = ""; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const nomeCelula = (c, r) => (c < 0 || r < 0 ? "fora da grade" : `${letra(c)}${r + 1}`);
  const tamanhoMundo = () => {
    const m = M();
    return m.imagem && m.larguraImg ? { w: m.larguraImg, h: m.alturaImg } : { w: m.colunas * m.celula + m.ox, h: m.linhas * m.celula + m.oy };
  };
  const celulaDe = (wx, wy) => ({ c: Math.floor((wx - M().ox) / M().celula), r: Math.floor((wy - M().oy) / M().celula) });
  const centroCelula = (c, r) => ({ x: M().ox + (c + 0.5) * M().celula, y: M().oy + (r + 0.5) * M().celula });

  // ───────── Distância (regra configurável — o vault ainda não define) ─────────
  const METRICAS = {
    "": { nome: "Não definida", f: null },
    chebyshev: { nome: "Diagonal = 1 quadrado", f: (dx, dy) => Math.max(dx, dy) },
    alternada: { nome: "Diagonal alternada (1, 2, 1…)", f: (dx, dy) => Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2) },
    manhattan: { nome: "Sem diagonal (só reto)", f: (dx, dy) => dx + dy },
    euclidiana: { nome: "Linha reta (euclidiana)", f: (dx, dy) => Math.round(Math.hypot(dx, dy) * 10) / 10 },
  };
  function textoDistancia(a, b) {
    const dx = Math.abs(b.c - a.c), dy = Math.abs(b.r - a.r);
    const met = METRICAS[M().distancia || ""];
    let t = `${nomeCelula(a.c, a.r)} → ${nomeCelula(b.c, b.r)}: ${dx} col × ${dy} lin`;
    if (met.f) {
      const q = met.f(dx, dy);
      t += ` = ${fmt(q)} quadrado${q === 1 ? "" : "s"}`;
      if (M().metros) t += ` (${fmt(q * Number(M().metros))} m)`;
    } else t += " · regra de distância não definida";
    return t;
  }

  // ───────── Áreas de efeito (moldes visuais, sem regra) ─────────
  function celulasArea() {
    const a = ui.area;
    if (!a) return [];
    const m = M();
    const out = [];
    const n = ui.tamanho;
    const alvo = a.alvo;
    const origem = a.origem || alvo;
    const { w, h } = tamanhoMundo();
    const maxC = Math.ceil((w - m.ox) / m.celula), maxR = Math.ceil((h - m.oy) / m.celula);
    const ang = Math.atan2(alvo.r - origem.r, alvo.c - origem.c);
    for (let c = Math.max(0, Math.min(origem.c, alvo.c) - n - 1); c <= Math.min(maxC, Math.max(origem.c, alvo.c) + n + 1); c++) {
      for (let r = Math.max(0, Math.min(origem.r, alvo.r) - n - 1); r <= Math.min(maxR, Math.max(origem.r, alvo.r) + n + 1); r++) {
        let dentro = false;
        if (ui.forma === "circulo") dentro = Math.hypot(c - alvo.c, r - alvo.r) <= n + 0.01;
        else if (ui.forma === "quadrado") { const meio = Math.floor(n / 2); dentro = c >= alvo.c - meio && c < alvo.c - meio + n && r >= alvo.r - meio && r < alvo.r - meio + n; }
        else {
          const dx = c - origem.c, dy = r - origem.r;
          const dist = Math.hypot(dx, dy);
          if (dist === 0 || dist > n + 0.01) dentro = false;
          else if (ui.forma === "cone") { let d = Math.atan2(dy, dx) - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); dentro = Math.abs(d) <= (ui.abertura / 2) * Math.PI / 180 + 0.001; }
          else { const proj = dx * Math.cos(ang) + dy * Math.sin(ang); const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang)); dentro = proj > 0 && proj <= n + 0.01 && perp <= 0.5; }
        }
        if (dentro) out.push({ c, r });
      }
    }
    return out;
  }
  function origemDoSelecionado() {
    if (ui.forma !== "cone" && ui.forma !== "linha") return null;
    const p = ui.sel ? App.part(ui.sel) : null;
    return p && p.x !== null ? { c: p.x + Math.floor(p.tam / 2), r: p.y + Math.floor(p.tam / 2) } : null;
  }
  function tokensNaArea(cels) {
    const set = new Set(cels.map((x) => `${x.c},${x.r}`));
    return App.participantes().filter((p) => p.noMapa && p.x !== null && Array.from({ length: p.tam * p.tam }, (_, i) => `${p.x + (i % p.tam)},${p.y + Math.floor(i / p.tam)}`).some((k) => set.has(k)));
  }

  // ───────── Posicionamento inicial ─────────
  function posicionarTodos(soFaltantes) {
    const ps = App.participantes().filter((p) => p.noMapa && (!soFaltantes || p.x === null));
    if (!ps.length) return;
    const m = M();
    const cols = Math.max(8, Math.floor((tamanhoMundo().w - m.ox) / m.celula));
    let ia = 0, ii = 0;
    App.mudar(soFaltantes ? null : "Tokens reposicionados no mapa.", () => {
      for (const p of ps) {
        if (p.lado === "aliado") { p.x = 1 + (ia % 3) * 2; p.y = 1 + Math.floor(ia / 3) * 2; ia++; }
        else { p.x = Math.max(4, cols - 3 - (ii % 3) * (p.tam + 1)); p.y = 1 + Math.floor(ii / 3) * 3; ii++; }
      }
    }, { semRedesenho: true });
  }

  // ───────── Desenho ─────────
  function aplicarVista() {
    const mundo = el.querySelector(".mundo");
    const m = M();
    mundo.style.transform = `translate(${m.px}px, ${m.py}px) scale(${m.zoom})`;
  }
  function salvarVista() {
    clearTimeout(salvarVistaT);
    salvarVistaT = setTimeout(App.salvar, 300);
  }

  function desenharGrade() {
    const m = M();
    const { w, h } = tamanhoMundo();
    const mundo = el.querySelector(".mundo");
    mundo.style.width = w + "px";
    mundo.style.height = h + "px";
    const fundo = mundo.querySelector(".fundo-vazio");
    if (fundo) { fundo.style.width = w + "px"; fundo.style.height = h + "px"; }
    const svg = mundo.querySelector("svg.grade");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.innerHTML = m.grade ? `<defs><pattern id="padrao-grade" width="${m.celula}" height="${m.celula}" patternUnits="userSpaceOnUse" x="${m.ox}" y="${m.oy}">
        <path d="M ${m.celula} 0 L 0 0 0 ${m.celula}" fill="none" stroke="rgba(236,228,208,.22)" stroke-width="1"/></pattern></defs>
      <rect x="${m.ox}" y="${m.oy}" width="${Math.max(0, w - m.ox)}" height="${Math.max(0, h - m.oy)}" fill="url(#padrao-grade)"/>` : "";
  }

  function desenharSobreposicao() {
    const m = M();
    const svg = el.querySelector("svg.sobre");
    const { w, h } = tamanhoMundo();
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    let s = "";
    if (ui.hover && ui.ferramenta !== "mover") s += `<rect x="${m.ox + ui.hover.c * m.celula}" y="${m.oy + ui.hover.r * m.celula}" width="${m.celula}" height="${m.celula}" fill="rgba(242,207,99,.12)" stroke="var(--brasa)" stroke-width="1.5"/>`;
    const cels = celulasArea();
    for (const c of cels) s += `<rect x="${m.ox + c.c * m.celula}" y="${m.oy + c.r * m.celula}" width="${m.celula}" height="${m.celula}" fill="rgba(238,79,162,.26)" stroke="rgba(238,79,162,.7)" stroke-width="1"/>`;
    const regua = ui.arrasto && ui.arrasto.tipo === "token" && ui.arrasto.movido ? { a: ui.arrasto.origem, b: ui.arrasto.destino } : ui.regua;
    if (regua && regua.b) {
      const A = centroCelula(regua.a.c, regua.a.r), B = centroCelula(regua.b.c, regua.b.r);
      s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="var(--brasa)" stroke-width="${3 / m.zoom}" stroke-dasharray="${8 / m.zoom} ${6 / m.zoom}"/><circle cx="${A.x}" cy="${A.y}" r="${6 / m.zoom}" fill="var(--brasa)"/><circle cx="${B.x}" cy="${B.y}" r="${6 / m.zoom}" fill="var(--brasa)"/>`;
    }
    svg.innerHTML = s;
    const leitura = el.querySelector(".leitura-medida");
    let texto = "";
    if (regua && regua.b) texto = textoDistancia(regua.a, regua.b);
    else if (ui.area) texto = `${{ circulo: "Círculo", quadrado: "Quadrado", cone: "Cone", linha: "Linha" }[ui.forma]} de ${ui.tamanho} — ${cels.length} quadrados`;
    else if (ui.hover) texto = nomeCelula(ui.hover.c, ui.hover.r);
    leitura.hidden = !texto;
    leitura.textContent = texto;
  }

  function desenharTokens() {
    const m = M();
    const mundo = el.querySelector(".mundo");
    mundo.querySelectorAll(".token").forEach((t) => t.remove());
    const vez = App.estado.batalha.vez;
    for (const p of App.participantes()) {
      if (!p.noMapa || p.x === null || p.x === undefined) continue;
      const d = p.tam * m.celula * 0.86;
      const c = { x: m.ox + (p.x + p.tam / 2) * m.celula, y: m.oy + (p.y + p.tam / 2) * m.celula };
      const url = App.retratoDe(p);
      const pct = p.vidaMax ? Math.max(0, Math.min(100, (p.vida / p.vidaMax) * 100)) : null;
      const t = document.createElement("div");
      t.className = `token ${p.lado === "inimigo" ? "inimigo" : ""} ${p.id === ui.sel ? "selecionado" : ""} ${p.id === vez ? "vez" : ""}`;
      t.style.cssText = `left:${c.x}px;top:${c.y}px;width:${d}px;height:${d}px;font-size:${d * 0.36}px;--anel:${App.corDe(p)};${p.estado === "morto" ? "opacity:.45;filter:grayscale(1);" : ""}`;
      t.dataset.id = p.id;
      t.setAttribute("role", "button");
      t.setAttribute("tabindex", "0");
      t.setAttribute("aria-label", `${p.nome}${p.vidaMax ? `, vida ${p.vida} de ${p.vidaMax}` : ""}, em ${nomeCelula(p.x, p.y)}`);
      t.innerHTML = `${url ? `<img src="${url}" alt="">` : esc(App.iniciais(p.nome))}
        ${pct !== null ? `<span class="hp"><i style="width:${pct}%"></i></span>` : ""}
        ${p.condicoes.length ? `<span class="marca-cond" title="${esc(p.condicoes.map((x) => x.nome + (x.estagio ? " " + x.estagio : "")).join(", "))}">${p.condicoes.length}</span>` : ""}
        <span class="rotulo-token">${esc(p.nome.split(" ")[0])}</span>`;
      mundo.appendChild(t);
    }
  }

  function desenharLado() {
    const lado = el.querySelector(".lado-mapa");
    const p = ui.sel ? App.part(ui.sel) : null;
    const naArea = ui.area ? tokensNaArea(celulasArea()) : [];
    const ps = App.participantes();
    lado.innerHTML = `
      ${p ? `<section class="painel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">${App.htmlRetrato(p, "g")}<div><h3 style="margin:0">${esc(p.nome)}</h3><div class="sutil" style="font-size:14px">${esc(p.tipo.toLowerCase())}${p.x !== null ? `, em ${nomeCelula(p.x, p.y)}` : ""}</div></div></div>
        ${App.htmlBarra(p.vida, p.vidaMax, "vida")}
        ${p.manaMax ? `<div style="margin-top:6px">${App.htmlBarra(p.mana, p.manaMax, "mana")}</div>` : ""}
        ${p.condicoes.length ? `<div class="chips" style="margin-top:8px">${p.condicoes.map((c) => `<a class="chip wiki" data-nota="${esc(c.nome)}">${esc(c.nome)}${c.estagio ? " " + esc(c.estagio) : ""}</a>`).join("")}</div>` : ""}
        <div class="acao-rapida" style="justify-content:flex-start;margin-top:10px">
          <label class="visualmente-oculto" for="q-mapa">Valor</label><input id="q-mapa" type="number" min="0" placeholder="valor">
          <button class="btn mini" type="button" data-rapida="dano">Dano</button><button class="btn mini" type="button" data-rapida="cura">Cura</button>
        </div>
        ${App.entidade(p)?.movimentacao ? `<p class="sutil" style="font-size:14px;margin:8px 0 0">Movimentação na ficha: ${App.entidade(p).movimentacao} passos.</p>` : ""}
        <p style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0">
          ${p.ref && p.ref.tipo === "personagem" ? `<a class="btn mini" href="#/ficha/${encodeURIComponent(p.ref.id)}">Abrir ficha</a>` : ""}
          <button class="btn mini" type="button" data-vez-mapa>Marcar a vez</button>
          <button class="btn mini fantasma" type="button" data-tirar-mapa>Tirar do mapa</button>
        </p>
      </section>` : `<section class="painel"><p class="sutil" style="margin:0">Clique num token para ver vida e condições. Arraste para mover; ele se encaixa na grade.</p></section>`}

      ${ui.area ? `<section class="painel"><h3>Na área</h3>${naArea.length ? `<div class="chips">${naArea.map((x) => `<span class="chip">${esc(x.nome)}</span>`).join("")}</div>` : `<p class="sutil" style="margin:0">Nenhum token.</p>`}
        <p style="margin:10px 0 0"><button class="btn mini" type="button" data-limpar-area>Limpar área</button></p></section>` : ""}

      <section class="painel">
        <h3>No mapa</h3>
        <div class="lista-tokens">${ps.map((x) => `<label><input type="checkbox" data-no-mapa="${x.id}" ${x.noMapa ? "checked" : ""}> ${App.htmlRetrato(x, "", "width:26px;height:26px;font-size:12px")} <span style="flex:1">${esc(x.nome)}</span>${x.noMapa && x.x === null ? '<span class="fraco">sem lugar</span>' : ""}</label>`).join("")}</div>
        <p style="margin:10px 0 0;display:flex;gap:6px;flex-wrap:wrap"><button class="btn mini" type="button" data-posicionar>Posicionar todos</button></p>
      </section>

      <details class="painel">
        <summary><b>Grade e medidas</b></summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <label class="campo">Quadrado (px)<input type="number" data-cfg="celula" value="${M().celula}" min="10" style="width:100%"></label>
          <label class="campo" style="flex-direction:row;align-items:center;gap:6px;padding-top:20px"><input type="checkbox" data-cfg-bool="grade" ${M().grade ? "checked" : ""}> Mostrar grade</label>
          <label class="campo">Deslocar X<input type="number" data-cfg="ox" value="${M().ox}" style="width:100%"></label>
          <label class="campo">Deslocar Y<input type="number" data-cfg="oy" value="${M().oy}" style="width:100%"></label>
          ${M().imagem ? "" : `<label class="campo">Colunas<input type="number" data-cfg="colunas" value="${M().colunas}" min="4" style="width:100%"></label><label class="campo">Linhas<input type="number" data-cfg="linhas" value="${M().linhas}" min="4" style="width:100%"></label>`}
          <label class="campo" style="grid-column:1/-1">Regra de distância <span class="selo-duvida" style="width:max-content">o vault ainda não define</span>
            <select data-cfg-txt="distancia">${Object.entries(METRICAS).map(([k, v]) => `<option value="${k}" ${k === (M().distancia || "") ? "selected" : ""}>${v.nome}</option>`).join("")}</select></label>
          <label class="campo" style="grid-column:1/-1">Metros por quadrado (deixe vazio se não souber)<input type="number" step="0.5" data-cfg-txt="metros" value="${M().metros ?? ""}" style="width:100%"></label>
        </div>
        <p style="margin:12px 0 0;display:flex;gap:6px;flex-wrap:wrap">
          <label class="btn mini">${M().imagem ? "Trocar imagem" : "Carregar imagem do mapa"}<input type="file" accept="image/*" data-imagem hidden></label>
          ${M().imagem ? `<button class="btn mini perigo" type="button" data-sem-imagem>Remover imagem</button>` : ""}
        </p>
      </details>`;
    ligarLado(lado);
  }

  function desenhar() {
    desenharGrade();
    desenharTokens();
    desenharSobreposicao();
    desenharLado();
    aplicarVista();
    el.querySelectorAll("[data-ferramenta]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ferramenta === ui.ferramenta));
    el.querySelector(".opcoes-area").hidden = ui.ferramenta !== "area";
    el.querySelector(".palco").className = `palco ${ui.ferramenta === "regua" ? "regua" : ui.ferramenta === "area" ? "area" : ""}`;
  }

  // ───────── Imagem ─────────
  async function carregarImagemSalva() {
    const img = el.querySelector("img.fundo");
    const vazio = el.querySelector(".fundo-vazio");
    if (!M().imagem) { img.hidden = true; vazio.hidden = false; return; }
    try {
      const blob = await BD.ler();
      if (!blob) { img.hidden = true; vazio.hidden = false; return; }
      if (ui.urlImagem) URL.revokeObjectURL(ui.urlImagem);
      ui.urlImagem = URL.createObjectURL(blob);
      img.src = ui.urlImagem;
      img.hidden = false;
      vazio.hidden = true;
    } catch (e) { App.aviso("Não consegui ler a imagem salva do mapa."); }
  }
  function receberImagem(arquivo) {
    const url = URL.createObjectURL(arquivo);
    const im = new Image();
    im.onload = async () => {
      try { await BD.salvar(arquivo); } catch (e) { App.aviso("Não consegui guardar a imagem neste navegador."); }
      App.mudar(`Mapa carregado: ${arquivo.name} (${im.naturalWidth}×${im.naturalHeight}).`, (s) => {
        s.mapa.imagem = true; s.mapa.larguraImg = im.naturalWidth; s.mapa.alturaImg = im.naturalHeight;
      }, { semRedesenho: true });
      URL.revokeObjectURL(url);
      await carregarImagemSalva();
      centralizar();
      posicionarTodos(true);
      desenhar();
    };
    im.onerror = () => App.aviso("Esse arquivo não é uma imagem que o navegador consiga abrir.");
    im.src = url;
  }

  // ───────── Vista: zoom e pan ─────────
  function centralizar(tentativa) {
    const palco = el && el.querySelector(".palco");
    if (!palco) return;
    const { w, h } = tamanhoMundo();
    const r = palco.getBoundingClientRect();
    // o palco ainda não tem tamanho (layout não terminou): tenta no próximo quadro
    if (r.width < 80 || r.height < 80) { if ((tentativa || 0) < 20) requestAnimationFrame(() => centralizar((tentativa || 0) + 1)); return; }
    const z = Math.max(0.15, Math.min(r.width / w, r.height / h, 1.5) * 0.95);
    Object.assign(M(), { zoom: z, px: (r.width - w * z) / 2, py: (r.height - h * z) / 2 });
    aplicarVista();
    desenharSobreposicao();
    salvarVista();
  }
  function zoomEm(fator, cx, cy) {
    const m = M();
    const nz = Math.min(4, Math.max(0.15, m.zoom * fator));
    m.px = cx - ((cx - m.px) * nz) / m.zoom;
    m.py = cy - ((cy - m.py) * nz) / m.zoom;
    m.zoom = nz;
    aplicarVista();
    desenharSobreposicao();
    salvarVista();
  }
  function mundoDe(e) {
    const r = el.querySelector(".palco").getBoundingClientRect();
    const m = M();
    return { x: (e.clientX - r.left - m.px) / m.zoom, y: (e.clientY - r.top - m.py) / m.zoom, sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  function ligarPalco() {
    const palco = el.querySelector(".palco");
    palco.addEventListener("wheel", (e) => {
      e.preventDefault();
      const w = mundoDe(e);
      zoomEm(e.deltaY < 0 ? 1.12 : 1 / 1.12, w.sx, w.sy);
    }, { passive: false });

    palco.addEventListener("pointerdown", (e) => {
      ui.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      palco.setPointerCapture(e.pointerId);
      const w = mundoDe(e);
      const cel = celulaDe(w.x, w.y);
      if (ui.ponteiros.size === 2) { ui.arrasto = { tipo: "pinca", dist: null }; return; }
      const tok = e.target.closest(".token");
      if (tok && ui.ferramenta === "mover") {
        const p = App.part(tok.dataset.id);
        ui.sel = p.id;
        ui.arrasto = { tipo: "token", id: p.id, el: tok, origem: { c: p.x, r: p.y }, destino: { c: p.x, r: p.y }, dx: w.x - parseFloat(tok.style.left), dy: w.y - parseFloat(tok.style.top), movido: false };
        el.querySelectorAll(".token").forEach((t) => t.classList.toggle("selecionado", t === tok));
        desenharLado();
        return;
      }
      if (ui.ferramenta === "regua") { ui.regua = { a: cel, b: cel }; ui.arrasto = { tipo: "regua" }; desenharSobreposicao(); return; }
      if (ui.ferramenta === "area") {
        ui.area = { alvo: cel, origem: origemDoSelecionado(), fixa: !(ui.area && ui.area.fixa && ui.area.alvo.c === cel.c && ui.area.alvo.r === cel.r) };
        desenharSobreposicao();
        desenharLado();
        return;
      }
      ui.arrasto = { tipo: "pan", x: e.clientX, y: e.clientY, px: M().px, py: M().py, movido: false };
      palco.classList.add("arrastando");
    });

    palco.addEventListener("pointermove", (e) => {
      if (ui.ponteiros.has(e.pointerId)) ui.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const w = mundoDe(e);
      const cel = celulaDe(w.x, w.y);
      const a = ui.arrasto;
      if (a && a.tipo === "pinca" && ui.ponteiros.size === 2) {
        const [p1, p2] = [...ui.ponteiros.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const r = palco.getBoundingClientRect();
        if (a.dist) zoomEm(d / a.dist, (p1.x + p2.x) / 2 - r.left, (p1.y + p2.y) / 2 - r.top);
        a.dist = d;
        return;
      }
      if (a && a.tipo === "pan") {
        M().px = a.px + (e.clientX - a.x);
        M().py = a.py + (e.clientY - a.y);
        a.movido = a.movido || Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y) > 4;
        aplicarVista();
        return;
      }
      if (a && a.tipo === "token") {
        const p = App.part(a.id);
        a.el.style.left = w.x - a.dx + "px";
        a.el.style.top = w.y - a.dy + "px";
        const cx = w.x - a.dx, cy = w.y - a.dy;
        a.destino = { c: Math.round((cx - M().ox) / M().celula - p.tam / 2), r: Math.round((cy - M().oy) / M().celula - p.tam / 2) };
        a.movido = a.movido || a.destino.c !== a.origem.c || a.destino.r !== a.origem.r;
        desenharSobreposicao();
        return;
      }
      if (a && a.tipo === "regua") { ui.regua.b = cel; desenharSobreposicao(); return; }
      if (ui.ferramenta === "area" && (!ui.area || !ui.area.fixa)) {
        const mudou = !ui.area || ui.area.alvo.c !== cel.c || ui.area.alvo.r !== cel.r;
        ui.area = { alvo: cel, origem: origemDoSelecionado(), fixa: false };
        if (mudou) { ui.hover = cel; desenharSobreposicao(); }
        return;
      }
      if (!ui.hover || ui.hover.c !== cel.c || ui.hover.r !== cel.r) { ui.hover = cel; desenharSobreposicao(); }
    });

    const soltar = (e) => {
      ui.ponteiros.delete(e.pointerId);
      const a = ui.arrasto;
      ui.arrasto = null;
      palco.classList.remove("arrastando");
      if (!a) return;
      if (a.tipo === "pan") { salvarVista(); if (!a.movido) { ui.sel = null; desenharTokens(); desenharLado(); } return; }
      if (a.tipo === "token") {
        const p = App.part(a.id);
        if (!a.movido) { desenharTokens(); desenharSobreposicao(); return; }
        const dest = { c: Math.max(0, a.destino.c), r: Math.max(0, a.destino.r) };
        App.mudar(`${p.nome} moveu de ${nomeCelula(a.origem.c, a.origem.r)} para ${nomeCelula(dest.c, dest.r)} (${Math.abs(dest.c - a.origem.c)} col × ${Math.abs(dest.r - a.origem.r)} lin).`, () => { p.x = dest.c; p.y = dest.r; });
      }
    };
    palco.addEventListener("pointerup", soltar);
    palco.addEventListener("pointercancel", soltar);
    palco.addEventListener("pointerleave", () => { if (!ui.arrasto) { ui.hover = null; desenharSobreposicao(); } });

    palco.addEventListener("keydown", (e) => {
      const passo = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (e.key === "Escape") { ui.regua = null; ui.area = null; desenharSobreposicao(); desenharLado(); return; }
      if (e.key === "+" || e.key === "=") { const r = palco.getBoundingClientRect(); zoomEm(1.15, r.width / 2, r.height / 2); return; }
      if (e.key === "-") { const r = palco.getBoundingClientRect(); zoomEm(1 / 1.15, r.width / 2, r.height / 2); return; }
      if (!passo) return;
      e.preventDefault();
      const p = ui.sel ? App.part(ui.sel) : null;
      if (p && p.x !== null && !e.shiftKey) {
        const o = { c: p.x, r: p.y };
        App.mudar(`${p.nome} moveu de ${nomeCelula(o.c, o.r)} para ${nomeCelula(Math.max(0, o.c + passo[0]), Math.max(0, o.r + passo[1]))}.`, () => { p.x = Math.max(0, p.x + passo[0]); p.y = Math.max(0, p.y + passo[1]); });
        palco.focus();
      } else { M().px -= passo[0] * 60; M().py -= passo[1] * 60; aplicarVista(); salvarVista(); }
    });
    palco.addEventListener("focusin", (e) => {
      const tok = e.target.closest && e.target.closest(".token");
      if (tok && ui.sel !== tok.dataset.id) { ui.sel = tok.dataset.id; desenharLado(); el.querySelectorAll(".token").forEach((t) => t.classList.toggle("selecionado", t === tok)); }
    });
  }

  function ligarLado(lado) {
    const p = ui.sel ? App.part(ui.sel) : null;
    lado.querySelectorAll("[data-rapida]").forEach((b) => b.addEventListener("click", () => {
      const v = Math.abs(parseInt(lado.querySelector("#q-mapa").value, 10));
      if (!v) { App.aviso("Digite um valor primeiro."); return; }
      App.alterarVida(p.id, b.dataset.rapida === "dano" ? -v : v);
    }));
    lado.querySelector("[data-vez-mapa]")?.addEventListener("click", () => App.mudar(`Vez de ${p.nome} (definida no mapa).`, (s) => { s.batalha.vez = p.id; }));
    lado.querySelector("[data-tirar-mapa]")?.addEventListener("click", () => { App.mudar(`${p.nome} saiu do mapa.`, () => { p.noMapa = false; }); ui.sel = null; });
    lado.querySelector("[data-limpar-area]")?.addEventListener("click", () => { ui.area = null; desenhar(); });
    lado.querySelector("[data-posicionar]").addEventListener("click", () => { posicionarTodos(false); desenhar(); });
    lado.querySelectorAll("[data-no-mapa]").forEach((c) => c.addEventListener("change", () => {
      const x = App.part(c.dataset.noMapa);
      App.mudar(`${x.nome} ${c.checked ? "entrou no" : "saiu do"} mapa.`, () => { x.noMapa = c.checked; }, { semRedesenho: true });
      if (c.checked && x.x === null) posicionarTodos(true);
      desenhar();
    }));
    lado.querySelectorAll("[data-cfg]").forEach((i) => i.addEventListener("change", () => {
      const v = Number(i.value);
      if (!Number.isFinite(v)) return;
      App.mudar(null, (s) => { s.mapa[i.dataset.cfg] = i.dataset.cfg === "celula" ? Math.max(10, v) : v; }, { semRedesenho: true });
      desenhar();
    }));
    lado.querySelectorAll("[data-cfg-bool]").forEach((i) => i.addEventListener("change", () => { App.mudar(null, (s) => { s.mapa[i.dataset.cfgBool] = i.checked; }, { semRedesenho: true }); desenhar(); }));
    lado.querySelectorAll("[data-cfg-txt]").forEach((i) => i.addEventListener("change", () => {
      const k = i.dataset.cfgTxt;
      App.mudar(k === "distancia" ? `Regra de distância do mapa: ${METRICAS[i.value].nome}.` : `Metros por quadrado: ${i.value || "não definido"}.`, (s) => { s.mapa[k] = i.value; }, { semRedesenho: true });
      desenhar();
    }));
    lado.querySelector("[data-imagem]").addEventListener("change", (e) => e.target.files[0] && receberImagem(e.target.files[0]));
    lado.querySelector("[data-sem-imagem]")?.addEventListener("click", async () => {
      if (!App.confirmar("Remover a imagem do mapa? Os tokens continuam onde estão.")) return;
      try { await BD.apagar(); } catch (e) { /* segue */ }
      App.mudar("Imagem do mapa removida.", (s) => { s.mapa.imagem = false; }, { semRedesenho: true });
      await carregarImagemSalva();
      desenhar();
    });
  }

  function render(alvo) {
    el = alvo;
    ui.regua = null;
    ui.area = null;
    el.innerHTML = `
      <header class="cabeca" style="margin-bottom:12px">
        <div><h1>Mapa</h1><p>${esc(App.estado.batalha.titulo)}. Roda do mouse aproxima; arraste o fundo para mover a vista.</p></div>
      </header>
      <div class="mapa-ferramentas">
        <div class="segmentado" role="group" aria-label="Ferramenta">
          <button type="button" data-ferramenta="mover">Mover</button>
          <button type="button" data-ferramenta="regua">Régua</button>
          <button type="button" data-ferramenta="area">Área</button>
        </div>
        <div class="opcoes-area" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" hidden>
          <label class="visualmente-oculto" for="forma">Forma</label>
          <select id="forma"><option value="circulo">Círculo (raio)</option><option value="quadrado">Quadrado (lado)</option><option value="cone">Cone (a partir do token)</option><option value="linha">Linha (a partir do token)</option></select>
          <label class="campo" style="flex-direction:row;align-items:center;gap:6px">Tamanho<input id="tam-area" type="number" min="1" max="40" value="${ui.tamanho}" style="width:64px"> quadrados</label>
          <label class="campo abertura" style="flex-direction:row;align-items:center;gap:6px">Abertura<select id="abertura"><option>60</option><option selected>90</option><option>120</option></select>°</label>
        </div>
        <span class="fraco" style="font-size:14px">Moldes visuais: o tamanho real de cada área vem do poder e da regra de distância.</span>
      </div>
      <div class="mapa-layout">
        <div class="palco" tabindex="0" aria-label="Mapa de batalha. Setas movem o token selecionado; Shift+setas movem a vista; + e − dão zoom; Esc limpa régua e área.">
          <div class="mundo">
            <div class="fundo-vazio"></div>
            <img class="fundo" alt="" hidden>
            <svg class="camada grade" aria-hidden="true"></svg>
            <svg class="camada sobre" aria-hidden="true"></svg>
          </div>
          <div class="leitura-medida" hidden></div>
          <div class="zoom-ctrl">
            <button class="btn" type="button" data-zoom="1.2" aria-label="Aproximar">+</button>
            <button class="btn" type="button" data-zoom="0.83" aria-label="Afastar">−</button>
            <button class="btn" type="button" data-centralizar aria-label="Enquadrar o mapa">⌂</button>
          </div>
        </div>
        <aside class="lado-mapa"></aside>
      </div>`;
    el.querySelectorAll("[data-ferramenta]").forEach((b) => b.addEventListener("click", () => { ui.ferramenta = b.dataset.ferramenta; if (ui.ferramenta !== "area") ui.area = null; if (ui.ferramenta !== "regua") ui.regua = null; desenhar(); }));
    const forma = el.querySelector("#forma");
    forma.value = ui.forma;
    const atualizarForma = () => { el.querySelector(".abertura").hidden = ui.forma !== "cone"; };
    forma.addEventListener("change", () => { ui.forma = forma.value; atualizarForma(); desenharSobreposicao(); desenharLado(); });
    atualizarForma();
    el.querySelector("#tam-area").addEventListener("input", (e) => { ui.tamanho = Math.max(1, +e.target.value || 1); desenharSobreposicao(); desenharLado(); });
    el.querySelector("#abertura").addEventListener("change", (e) => { ui.abertura = +e.target.value; desenharSobreposicao(); desenharLado(); });
    el.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => { const r = el.querySelector(".palco").getBoundingClientRect(); zoomEm(+b.dataset.zoom, r.width / 2, r.height / 2); }));
    el.querySelector("[data-centralizar]").addEventListener("click", () => centralizar());
    el.querySelector("img.fundo").addEventListener("load", desenharGrade);
    ligarPalco();
    posicionarTodos(true);
    desenhar();
    carregarImagemSalva();
    if (!App.estado.mapa.vistaAjustada || !(App.estado.mapa.zoom >= 0.15)) { App.estado.mapa.vistaAjustada = true; centralizar(); }
  }

  App.vistas.mapa = {
    render,
    atualizar() {
      if (!el || !el.querySelector(".palco")) return;
      if (ui.sel && !App.part(ui.sel)) ui.sel = null;
      desenhar();
      const img = el.querySelector("img.fundo");
      if (M().imagem && img.hidden) carregarImagemSalva();
      if (!M().imagem && !img.hidden) carregarImagemSalva();
    },
  };
})();
