// =====================================================================
//  Caixa: o que entrou (por forma de pagamento), o que saiu, comissões e
//  o fechamento do dia, da semana e do mês.
//  - Dono (ou barbeiro com "ver o caixa da barbearia"): vê tudo.
//  - Barbeiro: vê só os próprios atendimentos, lançamentos e comissão.
// =====================================================================
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, numero, toast, abreModal, confirma, hoje, dataCurta, vazio } from "../util.js";
import { profsAtivos } from "../agenda.js";
import { FORMAS, nomeForma, resumoCaixa, periodo, vizinho, textoFechamento, valorPago, gorjetaDe } from "../caixa.js";

export function tela(el, rota) {
  let tipo = ["dia", "semana", "mes"].includes(rota.q.get("tipo")) ? rota.q.get("tipo") : "dia";
  let ref = /^\d{4}-\d{2}-\d{2}$/.test(rota.q.get("data") || "") ? rota.q.get("data") : hoje();
  const geral = D.pode("caixaGeral");
  let prof = geral ? "" : D.profId;            // "" = a barbearia inteira
  let ags = null, lancs = [], peds = [], coms = [];
  let paradasP = [];

  function ouve() {
    paradasP.forEach(f => f());
    const p = periodo(tipo, ref);
    ags = null;
    paradasP = [
      D.ouvir("agendamentos", [["data", ">=", p.ini], ["data", "<=", p.fim]], l => { ags = l; desenha(); }, () => { ags = []; desenha(); }),
      // o barbeiro só pode ler os próprios lançamentos: a consulta já pede só os dele (a regra do banco exige isso)
      geral ? D.ouvir("caixa", [["data", ">=", p.ini], ["data", "<=", p.fim]], l => { lancs = l; desenha(); }, () => { })
        : D.ouvir("caixa", [["por", "==", D.usuario.uid]], l => { lancs = l; desenha(); }, () => { })
    ];
    if (geral) paradasP.push(D.ouvir("pedidos", [["status", "==", "retirado"]], l => { peds = l; desenha(); }, () => { }));
    // comissões: ficam fora do agendamento para o cliente não ver quanto o barbeiro ganha
    paradasP.push(geral ? D.ouvir("comissoes", [["data", ">=", p.ini], ["data", "<=", p.fim]], l => { coms = l; desenha(); }, () => { })
      : D.ouvir("comissoes", [["profissional", "==", D.profId]], l => { coms = l; desenha(); }, () => { }));
    desenha();
  }

  function desenha() {
    const p = periodo(tipo, ref);
    const cab = `<div class="titulo-tela"><div><h1>Caixa</h1><p>${esc(p.titulo)}${geral ? "" : " · seus atendimentos"}</p></div>
        <div class="botoes"><button class="btn mini sec" id="saida">${icone("menos")} Saída</button><button class="btn mini" id="entrada">${icone("mais")} Entrada</button></div></div>
      <div class="seg" style="margin-bottom:12px">${[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([v, t]) => `<button class="${tipo === v ? "ativo" : ""}" data-t="${v}">${t}</button>`).join("")}</div>
      <div class="barra-dia">
        <button class="icone-btn" data-v="-1" aria-label="Período anterior">${icone("voltar")}</button>
        <div class="meio"><strong>${esc(tipo === "dia" ? dataCurta(ref) : p.titulo)}</strong><small>${tipo === "dia" ? esc(p.titulo) : `${dataCurta(p.ini)} a ${dataCurta(p.fim)}`}</small></div>
        ${p.fim < hoje() || p.ini > hoje() ? `<button class="btn mini sec" id="agora">Hoje</button>` : ""}
        <button class="icone-btn" data-v="1" aria-label="Próximo período" ${p.fim >= hoje() ? "disabled" : ""}>${icone("seta")}</button>
      </div>`;
    if (!ags) { el.innerHTML = cab + `<div class="carregando"><span></span></div>`; liga(); return; }

    const cm = Object.fromEntries(coms.map(c => [c.id, c]));
    const r = resumoCaixa({ ags: ags.map(a => ({ ...a, comissaoValor: cm[a.id] ? cm[a.id].valor : 0 })), lancs, peds, ini: p.ini, fim: p.fim, prof });
    const profs = profsAtivos();
    const meu = prof && r.comissoes[prof];
    const formas = Object.entries(r.formas).filter(([, v]) => v);
    const max = Math.max(1, ...formas.map(f => f[1]));
    const linhas = [
      ...r.feitos.map(a => ({ k: a.data + a.inicio, h: `<div class="item"><span class="mov ok">${icone("tesoura")}</span><div class="meio"><strong>${esc(a.clienteNome || "Cliente")}</strong><small>${tipo === "dia" ? "" : dataCurta(a.data).slice(0, 5) + " · "}${a.inicio} · ${esc((a.servicos || []).map(s => s.nome).join(" + "))} · ${esc(a.profissionalNome || "")}</small></div><div class="lado"><span class="preco">${reais(valorPago(a))}</span><span class="pill">${esc(nomeForma(a.pagamento && a.pagamento.forma))}${a.premio ? " · prêmio" : ""}</span>${gorjetaDe(a) ? `<span class="pill destaque">gorjeta ${reais(gorjetaDe(a))}</span>` : a.pagamento && a.pagamento.troco ? `<small class="muted">troco ${reais(a.pagamento.troco)}</small>` : ""}</div></div>` })),
      ...r.listaVendas.map(v => ({ k: dataDo(v) + "99", h: `<div class="item"><span class="mov ok">${icone("sacola")}</span><div class="meio"><strong>Shop: ${esc(v.clienteNome || "cliente")}</strong><small>${esc(v.itens.map(i => `${i.qtd}× ${i.nome}`).join(", "))}</small></div><div class="lado"><span class="preco">${reais((v.pagamento && v.pagamento.valor) ?? v.total)}</span><span class="pill">${esc(nomeForma(v.pagamento && v.pagamento.forma))}</span></div></div>` })),
      ...[...r.listaEntradas, ...r.listaSaidas].map(l => ({ k: l.data + "98" + l.em, h: `<div class="item"><span class="mov ${l.tipo === "saida" ? "perigo" : "ok"}">${icone(l.tipo === "saida" ? "menos" : "mais")}</span><div class="meio"><strong>${esc(l.descricao || (l.tipo === "saida" ? "Saída" : "Entrada"))}</strong><small>${tipo === "dia" ? "" : dataCurta(l.data).slice(0, 5) + " · "}${l.tipo === "saida" ? "Saída" : "Entrada avulsa"} · ${esc(nomeForma(l.forma))}${l.porNome ? " · por " + esc(l.porNome.split(" ")[0]) : ""}</small></div><div class="lado"><span class="preco" ${l.tipo === "saida" ? 'style="color:var(--perigo)"' : ""}>${l.tipo === "saida" ? "− " : ""}${reais(l.valor)}</span>${D.ehDono || l.por === D.usuario.uid ? `<button class="icone-btn" data-del="${esc(l.id)}" aria-label="Apagar lançamento">${icone("lixo")}</button>` : ""}</div></div>` }))
    ].sort((a, b) => a.k.localeCompare(b.k));

    el.innerHTML = cab + `
      ${geral && profs.length > 1 ? `<div class="chips" style="margin-bottom:12px"><button class="chip ${!prof ? "ativo" : ""}" data-p="">Barbearia inteira</button>${profs.map(x => `<button class="chip ${prof === x.id ? "ativo" : ""}" data-p="${esc(x.id)}">${esc(x.nome)}</button>`).join("")}</div>` : ""}
      ${r.marcados ? `<div class="faixa alerta" style="margin-bottom:14px">${icone("relogio")}<div><strong>${r.marcados} ${r.marcados === 1 ? "horário ainda em aberto" : "horários ainda em aberto"} neste período</strong><p>O fechamento fica completo quando todos forem concluídos, cancelados ou marcados como falta.</p></div></div>` : ""}
      <div class="kpis">
        <div class="kpi destaque"><small>Entradas</small><b>${reais(r.entradas)}</b><i>serviços ${reais(r.servicos)}${r.produtos ? ` · shop ${reais(r.produtos)}` : ""}${r.avulsas ? ` · outras ${reais(r.avulsas)}` : ""}</i></div>
        <div class="kpi"><small>Saídas</small><b>${reais(r.saidas)}</b><i>${r.listaSaidas.length} ${r.listaSaidas.length === 1 ? "lançamento" : "lançamentos"}</i></div>
        <div class="kpi"><small>Saldo</small><b>${reais(r.saldo)}</b><i>entradas − saídas</i></div>
        ${prof ? `<div class="kpi"><small>${prof === D.profId ? "Sua comissão" : "Comissão"}</small><b>${reais(meu ? meu.valor : 0)}</b><i>${meu ? meu.atend : 0} atend. · sobre ${reais(meu ? meu.base : 0)}${meu && meu.gorjeta ? ` · + ${reais(meu.gorjeta)} de gorjeta` : ""}</i></div>`
          : `<div class="kpi"><small>Comissões</small><b>${reais(r.totalComissoes)}</b><i>fica para a casa ${reais(r.liquido)}</i></div>`}
      </div>
      <div class="info-grid secao">
        <div class="card"><h3 style="margin-bottom:12px">Como entrou</h3>
          ${formas.length ? `<div class="barras">${formas.map(([f, v]) => `<div class="b"><span>${esc(nomeForma(f))}</span><i style="width:${(v / max) * 100}%"></i><em>${reais(v)}</em></div>`).join("")}</div>` : `<p class="muted">Nada entrou neste período.</p>`}</div>
        <div class="card"><h3 style="margin-bottom:12px">Movimento</h3>
          <table class="horario-tab"><tbody>
            <tr><td>Atendimentos concluídos</td><td>${r.atendimentos}</td></tr>
            <tr><td>Ticket médio</td><td>${reais(r.ticket)}</td></tr>
            <tr><td>Cancelamentos</td><td>${r.cancelados}${r.canceladosCliente ? ` <small class="muted">(${r.canceladosCliente} pelo cliente)</small>` : ""}</td></tr>
            <tr><td>Não compareceram</td><td>${r.faltas}</td></tr>
            <tr><td>Horários vagos preenchidos</td><td>${r.preenchidos}</td></tr>
            ${r.troco ? `<tr><td>Troco devolvido</td><td>${reais(r.troco)}</td></tr>` : ""}
            ${r.gorjetas ? `<tr><td>Gorjetas <small class="muted">(de quem atendeu)</small></td><td>${reais(r.gorjetas)}</td></tr>` : ""}
            ${r.premios ? `<tr><td>Prêmios de fidelidade usados</td><td>${r.premios}</td></tr>` : ""}
            ${!prof && r.vendas ? `<tr><td>Vendas do shop</td><td>${r.vendas}</td></tr>` : ""}
          </tbody></table></div>
      </div>
      ${!prof && Object.keys(r.comissoes).length ? `<section class="secao"><div class="secao-topo"><h2>Comissões</h2></div>
        <div class="lista">${Object.values(r.comissoes).map(c => `<div class="item"><div class="meio"><strong>${esc(c.nome)}</strong><small>${c.atend} ${c.atend === 1 ? "atendimento" : "atendimentos"} · faturou ${reais(c.base)}${c.gorjeta ? ` · gorjetas ${reais(c.gorjeta)}` : ""}</small></div><div class="lado"><span class="preco">${reais(c.valor)}</span></div></div>`).join("")}
        <div class="item"><div class="meio"><strong>Fica para a casa</strong><small>entradas − saídas − comissões</small></div><div class="lado"><span class="preco">${reais(r.liquido)}</span></div></div></div></section>` : ""}
      <section class="secao"><div class="secao-topo"><h2>Lançamentos</h2><span class="muted pequeno">${linhas.length}</span></div>
        ${linhas.length ? `<div class="lista">${linhas.map(x => x.h).join("")}</div>` : vazio("dinheiro", "Nada lançado neste período", "Os atendimentos entram aqui quando você toca em “Concluir e receber” na agenda.")}
      </section>
      <div class="botoes secao nao-imprime">
        <button class="btn sec" id="copiar">${icone("copiar")} Copiar resumo</button>
        <a class="btn whats" id="zap" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(textoFechamento(r, p.titulo, S.nomeLoja()))}">${icone("whats")} Mandar no WhatsApp</a>
        <button class="btn sec" id="imprimir">${icone("baixar")} Imprimir / PDF</button>
      </div>`;
    liga(r, p);
  }

  const dataDo = v => { const d = new Date(v.atualizadoEm || v.criadoEm || 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  function liga(r, p) {
    el.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => { tipo = b.dataset.t; ouve(); }));
    el.querySelectorAll("[data-v]").forEach(b => b.addEventListener("click", () => { ref = vizinho(tipo, ref, Number(b.dataset.v)); ouve(); }));
    el.querySelector("#agora")?.addEventListener("click", () => { ref = hoje(); ouve(); });
    el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { prof = b.dataset.p; desenha(); }));
    el.querySelector("#saida").addEventListener("click", () => lancar("saida"));
    el.querySelector("#entrada").addEventListener("click", () => lancar("entrada"));
    el.querySelector("#copiar")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(textoFechamento(r, p.titulo, S.nomeLoja())); toast("Resumo copiado.", "ok"); }
      catch (e) { toast("Não deu para copiar. Use “Mandar no WhatsApp”.", "erro"); }
    });
    el.querySelector("#imprimir")?.addEventListener("click", () => window.print());
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (!await confirma("Apagar este lançamento?", "Ele sai do caixa e dos fechamentos.", "Apagar", true)) return;
      try { await D.apagar("caixa", b.dataset.del); toast("Lançamento apagado."); } catch (e) { toast(traduzErro(e), "erro"); }
    }));
  }

  function lancar(qual) {
    const saida = qual === "saida";
    abreModal({
      titulo: saida ? "Lançar saída" : "Lançar entrada",
      corpo: `<p class="muted" style="margin-bottom:12px">${saida ? "Tudo que saiu do caixa: compra de produto, conta, material, retirada." : "Dinheiro que entrou fora de um atendimento ou do shop (ex.: venda no balcão, gorjeta)."}</p>
        <label class="campo"><span>Valor *</span><input id="lv" inputmode="decimal" placeholder="0,00"></label>
        <label class="campo"><span>Descrição *</span><input id="ld" maxlength="80" placeholder="${saida ? "Ex.: lâminas, conta de luz" : "Ex.: venda de pomada no balcão"}"></label>
        <div class="linha2"><label class="campo"><span>Forma</span><select id="lf">${Object.entries(FORMAS).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
          <label class="campo"><span>Dia</span><input type="date" id="lq" value="${tipo === "dia" ? ref : hoje()}" max="${hoje()}"></label></div>`,
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Lançar", fn: async m => {
          const valor = Math.round(numero(m.querySelector("#lv").value) * 100) / 100, descricao = m.querySelector("#ld").value.trim(), data = m.querySelector("#lq").value;
          if (!(valor > 0) || valor > 100000) { toast("Digite o valor.", "erro"); return false; }
          if (descricao.length < 2) { toast("Diga do que se trata.", "erro"); return false; }
          if (!data || data > hoje()) { toast("Escolha o dia.", "erro"); return false; }
          try {
            await D.criar("caixa", { tipo: qual, valor, descricao, forma: m.querySelector("#lf").value, data, em: Date.now(), por: D.usuario.uid, porNome: (S.profissional(D.profId) || {}).nome || D.usuario.nome || "", profissional: D.profId || "" });
            toast(saida ? "Saída lançada." : "Entrada lançada.", "ok");
          } catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  const p = S.ao(q => (q === "profissionais" || q === "loja") && ags && desenha());
  ouve();
  return () => { p(); paradasP.forEach(f => f()); };
}
