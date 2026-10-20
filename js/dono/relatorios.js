// Relatórios: faturamento, atendimentos, equipe, serviços, produtos e aniversariantes
import { D } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, hoje, somaDias, dataDe, DIAS_C, MESES, linkWhats, dataCurta, vazio } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  let periodo = "mes", ags = null, peds = [], clientes = [];
  const paradas = [];

  function intervalo() {
    const h = hoje(), d = dataDe(h);
    if (periodo === "hoje") return [h, h];
    if (periodo === "7d") return [somaDias(h, -6), h];
    if (periodo === "mes") return [h.slice(0, 8) + "01", h];
    if (periodo === "mesp") { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return [iso(a), iso(b)]; }
    return [h.slice(0, 4) + "-01-01", h];
  }
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const dataMs = ms => iso(new Date(ms));

  // barras horizontais (uma série, uma cor; o valor fica em texto ao lado)
  const barras = (pares, fmt = v => v) => {
    const max = Math.max(1, ...pares.map(p => p[1]));
    return pares.length ? `<div class="barras">${pares.map(([n, v]) => `<div class="b" title="${esc(n)}: ${esc(fmt(v))}"><span>${esc(n)}</span><i style="width:${(v / max) * 100}%"></i><em>${fmt(v)}</em></div>`).join("")}</div>` : `<p class="muted">Sem dados no período.</p>`;
  };

  function desenha() {
    if (!ags) { el.innerHTML = titulo("Relatórios") + `<div class="carregando"><span></span></div>`; return; }
    const [ini, fim] = intervalo();
    const noP = ags.filter(a => a.data >= ini && a.data <= fim);
    const feitos = noP.filter(a => a.status === "concluido");
    const vendas = peds.filter(p => p.status === "retirado" && dataMs(p.atualizadoEm || p.criadoEm) >= ini && dataMs(p.atualizadoEm || p.criadoEm) <= fim);
    const fatServ = feitos.reduce((s, a) => s + Number(a.total || 0), 0);
    const fatProd = vendas.reduce((s, p) => s + Number(p.total || 0), 0);
    const faltas = noP.filter(a => a.status === "faltou").length, canc = noP.filter(a => a.status === "cancelado").length;
    const unicos = new Set(feitos.map(a => a.uid)).size;
    const novos = clientes.filter(c => c.criadoEm && dataMs(c.criadoEm) >= ini && dataMs(c.criadoEm) <= fim).length;

    // faturamento por dia (ou por mês no ano)
    const porTempo = [];
    if (periodo === "ano") {
      for (let m = 0; m <= Number(fim.slice(5, 7)) - 1; m++) { const k = `${fim.slice(0, 4)}-${String(m + 1).padStart(2, "0")}`; porTempo.push([MESES[m].slice(0, 3), feitos.filter(a => a.data.startsWith(k)).reduce((s, a) => s + a.total, 0)]); }
    } else if (periodo !== "hoje") {
      for (let d = ini; d <= fim; d = somaDias(d, 1)) porTempo.push([periodo === "7d" ? DIAS_C[dataDe(d).getDay()] : String(dataDe(d).getDate()), feitos.filter(a => a.data === d).reduce((s, a) => s + a.total, 0), d]);
    }
    const maxT = Math.max(1, ...porTempo.map(p => p[1]));

    const porProf = {}; feitos.forEach(a => { const k = a.profissionalNome || "—"; porProf[k] = (porProf[k] || 0) + a.total; });
    const porServ = {}; feitos.forEach(a => (a.servicos || []).forEach(s => porServ[s.nome] = (porServ[s.nome] || 0) + 1));
    const porProd = {}; vendas.forEach(p => p.itens.forEach(i => porProd[i.nome] = (porProd[i.nome] || 0) + i.qtd));
    const porHora = {}; noP.filter(a => a.status !== "cancelado").forEach(a => { const h = a.inicio.slice(0, 2) + "h"; porHora[h] = (porHora[h] || 0) + 1; });
    const ordena = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
    const mes = hoje().slice(5, 7);
    const aniv = clientes.filter(c => c.nascimento && c.nascimento.slice(5, 7) === mes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));

    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Relatórios", `${dataCurta(ini)}${ini !== fim ? " a " + dataCurta(fim) : ""} · só atendimentos concluídos entram no faturamento`) + `
      <div class="seg" style="margin-bottom:14px">${[["hoje", "Hoje"], ["7d", "7 dias"], ["mes", "Este mês"], ["mesp", "Mês passado"], ["ano", "Ano"]].map(([v, t]) => `<button class="${periodo === v ? "ativo" : ""}" data-p="${v}">${t}</button>`).join("")}</div>
      <div class="kpis">
        <div class="kpi ouro"><small>Faturamento</small><b>${reais(fatServ + fatProd)}</b><i>serviços ${reais(fatServ)} · shop ${reais(fatProd)}</i></div>
        <div class="kpi"><small>Atendimentos</small><b>${feitos.length}</b><i>${unicos} clientes</i></div>
        <div class="kpi"><small>Ticket médio</small><b>${reais(feitos.length ? fatServ / feitos.length : 0)}</b></div>
        <div class="kpi"><small>Faltas / cancel.</small><b>${faltas} / ${canc}</b><i>${novos} clientes novos</i></div>
      </div>
      ${porTempo.length ? `<section class="secao card"><h3>Faturamento de serviços ${periodo === "ano" ? "por mês" : "por dia"}</h3>
        <div class="grafico-dias" role="img" aria-label="Faturamento ${periodo === "ano" ? "por mês" : "por dia"}">${porTempo.map(([n, v, d]) => `<div title="${esc(d ? dataCurta(d) : n)}: ${reais(v)}"><i style="height:${(v / maxT) * 100}%"></i><small>${esc(n)}</small></div>`).join("")}</div>
        <p class="pequeno muted" style="margin-top:6px">Maior: ${reais(maxT === 1 && !porTempo.some(p => p[1]) ? 0 : maxT)} · passe o dedo/mouse nas barras para ver o valor.</p></section>` : ""}
      <div class="info-grid secao">
        <div class="card"><h3 style="margin-bottom:12px">Faturamento por profissional</h3>${barras(ordena(porProf), reais)}</div>
        <div class="card"><h3 style="margin-bottom:12px">Serviços mais feitos</h3>${barras(ordena(porServ).slice(0, 8), v => v + "×")}</div>
        <div class="card"><h3 style="margin-bottom:12px">Produtos vendidos</h3>${barras(ordena(porProd).slice(0, 8), v => v + " un.")}</div>
        <div class="card"><h3 style="margin-bottom:12px">Horários mais procurados</h3>${barras(Object.entries(porHora).sort((a, b) => a[0].localeCompare(b[0])), v => v + "×")}</div>
      </div>
      <section class="secao"><div class="secao-topo"><h2>Aniversariantes de ${MESES[Number(mes) - 1]}</h2></div>
        ${aniv.length ? `<div class="lista">${aniv.map(c => `<div class="item"><span class="avatar">🎂</span><div class="meio"><strong>${esc(c.nome)}</strong><small>${dataCurta(c.nascimento).slice(0, 5)}${c.nascimento.slice(5) === hoje().slice(5) ? " · <b>hoje!</b>" : ""}</small></div>
          ${c.telefone ? `<a class="btn mini whats" target="_blank" rel="noopener" href="${linkWhats(c.telefone, `Parabéns, ${c.nome.split(" ")[0]}! 🎉 A Barbearia Rodrigues te deseja um ótimo aniversário. ${(S.loja && S.loja.cupomAniversario) || ""}`)}">${icone("whats")} Parabéns</a>` : ""}</div>`).join("")}</div>` : vazio("bolo", "Ninguém faz aniversário este mês")}
      </section>`;
    el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { periodo = b.dataset.p; desenha(); }));
  }

  paradas.push(D.ouvir("agendamentos", [], l => { ags = l; desenha(); }));
  paradas.push(D.ouvir("pedidos", [], l => { peds = l; desenha(); }));
  paradas.push(D.ouvir("clientes", [], l => { clientes = l; desenha(); }));
  desenha();
  return () => paradas.forEach(f => f());
}
