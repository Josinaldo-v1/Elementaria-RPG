---
tipo: "guia"
nome: "Guia do Vault"
aliases:
  - "Padrões de Documentação"
  - "Padrões"
cssclasses:
  - "wiki"
tags:
  - "guia"
  - "padroes"
---

# 🧭 Guia do Vault — Elementaria

> [!abstract] Para que serve
> Este vault é a **base de conhecimento** do universo de Elementaria (e a base de dados do futuro site). Aqui estão **como ele está organizado** e as **regras de escrita** que o dono do projeto e a equipe de staff seguem. Decisões pendentes: 🧭 Revisão do Universo · lista completa de pendências: ⚠️ Dúvidas e Conflitos · de onde veio cada coisa: Fontes.

## 1. Organização: por assunto do universo, não pela fonte
Cada coisa do mundo está **no lugar do assunto**. Não existem pastas "do Discord" ou "da planilha": a fonte aparece só na propriedade `fonte` e numa linha *Fonte:* discreta.

| Pasta | O que tem |
|---|---|
| `01 📖 Regras` | Como o sistema funciona: testes, críticos, combate, vida e mana, progressão, itens, moedas |
| `02 📊 Modificadores` · `03 🎯 Perícias` | Os 13 modificadores (+ Ether e Plasma) · os testes; `Especiais/` = perícias das fichas |
| `04 🌈 Elementos` | Os 13 elementos, `Afinidades/` e as doenças de cada elemento |
| `05 ⚔️ Classes` | Uma pasta por classe (classe, espírito, `Linhagens/`, `Aspectos/`, `Poderes/`), [[Feitiços e Poderes]], Graciados e Híbridos, `_Outras raças (só NPCs)/` |
| `06 🌀 Condições` | As condições e seus estágios |
| `07 🧙 Personagens` | A ficha de cada personagem e, na pasta com o nome dele, o **dossiê** (ficha, inventário, história, documentos…) |
| `08 🤝 Companheiros` | Companheiros do grupo |
| `09 👤 NPCs` | Uma pasta por classe/raça; `Figuras Históricas/` = pessoas de Tempos passados |
| `10 👹 Inimigos` | Inimigos, bosses e o `Bestiário/` |
| `11 🎒 Itens` · `12 🐾 Invocações` | Arsenal, conjuntos, poções · invocações e filiais |
| `13 📚 Lore` | `Reinos/`, `Locais/`, `Organizações/`, `Famílias/`, `História/`, `Cosmologia e Magia/`, `Cultura/`, `Seres/`, `Contos e Lendas/`, `Documentos e Diários/`, `Notícias/` |
| `14 🎲 Sessões` | Uma pasta por campanha (episódios e `Registros/` originais), `Eventos/`, batalhas, linha do tempo |
| `15 🔒 Mestre` | Mesa de trabalho do mestre (anotações, ideias, tarô, trilhas, imagens a catalogar, registros do ADM) |
| `90 🗂️ Bases` · `91 🧩 Templates` · `92 🗺️ Canvas` | Tabelas dinâmicas · modelos de nota · mapas visuais |
| `98 🗄️ Fontes` | Uma nota por fonte (servidores do Discord, planilhas, documento Word): o que é e para onde foi |
| `99 📎 Anexos` | Imagens |

## 2. Princípios
1. **Uma informação, um lugar.** Cada pessoa, lugar, item ou regra tem **uma** nota, e cada dado aparece **uma vez** na nota. Se duas fontes dizem a mesma coisa, fica uma versão; se dizem coisas diferentes, fica um `[CONFLITO]` mostrando as duas.
2. **O nome do arquivo é o nome oficial.** Outras grafias e apelidos vão em `aliases` — nunca numa segunda nota.
3. **Nada é inventado.** Todo fato tem fonte. O que falta vira `[DÚVIDA]`; o que as fontes dizem diferente vira `[CONFLITO]`.
4. **Inferência é pergunta.** Parentesco por sobrenome, datas deduzidas etc. entram como `[DÚVIDA]`, nunca como fato.
5. **Segredo do mestre fica marcado e no fim.** Nota inteira do mestre: `visibilidade: mestre`. Trecho do mestre dentro de uma nota pública: seção `## 🔒 Mestre` (uma só, sempre a **última**) — o site dos jogadores corta dali até o fim.
6. **Conversa privada** (jogador ↔ mestre): `visibilidade: privado`.

## 3. Nomenclatura
| O quê | Padrão | Exemplo |
|---|---|---|
| Pessoas | nome + sobrenome da fonte mais recente; títulos (Rei, Rainha…) na propriedade `cargo` | `Heraclion Terceiro` · cargo "Rei de Krateras" |
| Povos/classes | plural com acento; o singular em `singular` | `Náutilos` · singular "Náutilo" |
| Lugares | sem artigo | `Prisão Suspensa`, `Porto Maltez` |
| Espíritos e aspectos | grafia do servidor da classe; outras em `aliases` | `Oppervlak` |
| Registros de personagem | `Personagem · Assunto` | `Edouard Acer · Inventário` |
| Datas do mundo | `dd/mm/aaa/Tempo` | `20/10/011/3º` |
| Datas reais | `dd/mm/aaaa` no texto, `aaaa-mm-dd` nas propriedades | `data: 2025-05-10` |
| Tempos | 1º Tempo, 2º Tempo, 3º Tempo | — |

Grafias ainda em disputa (Pecttor × Pecctor, Mwangi × Mwagani, Zanett × Zenett…) estão em 🧭 Revisão do Universo. Decidida a grafia, a nota é renomeada e as outras formas vão para `aliases`.

## 4. Propriedades por tipo
Toda nota tem `tipo`, `nome`, `tags`, `fonte` e, quando couber, `aliases`, `imagem`, `visibilidade`. Links sempre como `[[Nota]]` (também nas listas). Números sem unidade quando entram em conta (`movimentacao: 12`, `pods: 340`); campo desconhecido fica **vazio**.

| Tipo | Obrigatórias | Opcionais |
|---|---|---|
| **personagem** | nome_completo, jogador, classe, linhagem, afinidade, nivel, os 13 modificadores e `res_*`, vida_total, mana_total | imagem, emblema, idade, nascimento |
| **npc** | classe, cargo, tempo_nativo, reino | cidade, familia, grupos, idade, falecido, graciado_por, imagem |
| **companheiro** | classe, afinidade, nivel | habilidades, imagem |
| **classe** | singular, reino, espirito, linhagens, aspectos | mana_por_nivel, icone |
| **linhagem · espirito · aspecto** | classe | titulo, representacao, genero, imagem |
| **poder** | classe, nivel, categoria (Ativa/Passiva/Reativa), modificador | custo_mana, dt, alcance, acerto, usos |
| **item** | categoria, raridade (nome da tabela de [[Raridades]]), pods | slot, dano, conjunto, portador, imagem |
| **inimigo** | nivel, vida_total, movimento, elementos | imagem |
| **lore** (reino, local, grupo, familia, historia, conto, documento, noticia…) | categoria | reino, data, autor, membros, imagem |
| **sessao** | episodio, data, campanha, personagens | npcs, locais, imagem |
| **canal** (registro) | personagem ou campanha, canal, mensagens, periodo | visibilidade |
| **fonte** | — | link |

## 5. Ordem das seções
1. `# Título` e o quadro-resumo (`[!abstract]`; nas fichas, o quadro `[!ficha]`)
2. O conteúdo do assunto (descrição, poderes, história, membros…)
3. `## ⚠️ Conflitos e dúvidas`
4. `## 🖼️ Galeria` (uma só) · `## 🎬 Aparições na campanha` · `## 🗂️ Dossiê`
5. `## 🔒 Mestre` — **sempre por último**

## 6. Como a staff trabalha
- **Corrigir textos e dados:** na planilha *Elementaria — Base de Dados* (Google Planilhas) ou no documento *Livro do Mundo* (Google Docs). As correções voltam para o vault na próxima atualização.
- **Decidir pendências:** coluna *Decisão* da aba **🧾 Decisões da staff** (planilha) — a mesma lista está em 🧭 Revisão do Universo.
- **Quem cita esta nota:** aparece sozinho no pé de cada nota (menções do Obsidian: *Menções vinculadas* e *Menções não vinculadas*).
- **Editar direto no Obsidian:** pode. A nota editada passa a ser **protegida** — o gerador não a sobrescreve mais.

## 7. Como o vault é gerado
Os scripts de `rpg-manager/vault-builder/` leem as fontes e montam as notas (`run_all.py`). Um passo final organiza cada nota pelo assunto (galeria única, seção do mestre no fim, sem repetição) e apaga notas antigas que mudaram de lugar — **nunca** as que você editou. Depois, `exportar_json.py` gera os dados do site (sem nada do mestre).
