// Clientes: banco de dados com busca, aniversariantes, sumidos e planilha
import { D } from "../dados.js";
import { esc, icone, reais, avatar, normaliza, soDigitos, foneFormata, cpfOculto, hoje, dataCurta, vazio, debounce, somaDias } from "../util.js";
import { titulo } from "../ui.js";
import { novoClienteRapido } from "./agenda.js";
import { ir } from "../app.js";

export function tela(el) {
  let clientes = null, ags = [], busca = "", filtro = "todos", ordem = "nome";
  const paradas = [];

  const stats = () => {
    const m = {};
    for (const a of ags) {
      const s = (m[a.uid] ||= { visitas: 0, gasto: 0, ultima: "", proxima: "" });
      if (a.status === "concluido") { s.visitas++; s.gasto += Number(a.total || 0); if (a.data > s.ultima) s.ultima = a.data; }
      if (["marcado", "confirmado"].includes(a.status) && a.data >= hoje() && (!s.proxima || a.data < s.proxima)) s.proxima = a.data;
    }
    return m;
  };

  const desenha = () => {
    if (!clientes) { el.innerHTML = titulo("Clientes") + `<div class="carregando"><span></span></div>`; return; }
    const st = stats();
    const mes = hoje().slice(5, 7), lim = somaDias(hoje(), -45);
    const t = normaliza(busca), d = soDigitos(busca);
    let l = clientes.filter(c => !t || normaliza(c.nome).includes(t) || (d.length >= 3 && (soDigitos(c.cpf).includes(d) || soDigitos(c.telefone).includes(d))));
    if (filtro === "aniv") l = l.filter(c => c.nascimento && c.nascimento.slice(5, 7) === mes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));
    if (filtro === "sumidos") l = l.filter(c => st[c.id]?.ultima && st[c.id].ultima < lim && !st[c.id].proxima);
    if (filtro === "app") l = l.filter(c => !c.manual);
    if (filtro !== "aniv") l.sort(ordem === "gasto" ? (a, b) => (st[b.id]?.gasto || 0) - (st[a.id]?.gasto || 0) : ordem === "recente" ? (a, b) => (st[b.id]?.ultima || "").localeCompare(st[a.id]?.ultima || "") : (a, b) => a.nome.localeCompare(b.nome));
    const aniv = clientes.filter(c => c.nascimento && c.nascimento.slice(5, 7) === mes).length;
    el.innerHTML = titulo("Clientes", `${clientes.length} cadastrados · ${clientes.filter(c => !c.manual).length} usam o app`,
      `<div class="botoes"><button class="btn mini sec" id="csv">${icone("baixar")} Planilha</button><button class="btn mini" id="novo">${icone("mais")} Cliente</button></div>`) + `
      <div class="busca" style="margin-bottom:10px">${icone("busca")}<input type="search" id="busca" placeholder="Buscar por nome, CPF ou celular" value="${esc(busca)}"></div>
      <div class="chips" style="margin-bottom:10px">
        ${[["todos", "Todos"], ["aniv", `Aniversariantes do mês${aniv ? ` (${aniv})` : ""}`], ["sumidos", "Sumidos há 45+ dias"], ["app", "Usam o app"]].map(([v, t]) => `<button class="chip ${filtro === v ? "ativo" : ""}" data-f="${v}">${t}</button>`).join("")}
      </div>
      ${filtro !== "aniv" ? `<div class="seg" style="margin-bottom:12px">${[["nome", "A–Z"], ["recente", "Última visita"], ["gasto", "Quem mais gasta"]].map(([v, t]) => `<button class="${ordem === v ? "ativo" : ""}" data-o="${v}">${t}</button>`).join("")}</div>` : ""}
      ${l.length ? `<div class="lista">${l.map(c => { const s = st[c.id] || {}; return `<a class="item" href="#/dono/cliente/${encodeURIComponent(c.id)}">
        ${avatar(c.nome, "")}
        <div class="meio"><strong>${esc(c.nome)}</strong><small>${c.telefone ? esc(foneFormata(c.telefone)) + " · " : ""}${cpfOculto(c.cpf)}${filtro === "aniv" && c.nascimento ? ` · 🎂 ${dataCurta(c.nascimento).slice(0, 5)}` : ""}</small>
          <small>${s.visitas ? `${s.visitas} ${s.visitas === 1 ? "visita" : "visitas"} · última ${dataCurta(s.ultima)}` : "Sem visitas concluídas"}${s.proxima ? ` · próxima ${dataCurta(s.proxima)}` : ""}</small></div>
        <div class="lado">${s.gasto ? `<span class="preco">${reais(s.gasto)}</span>` : ""}${c.manual ? `<span class="pill">balcão</span>` : `<span class="pill destaque">app</span>`}</div></a>`; }).join("")}</div>`
        : vazio("usuarios", busca ? "Ninguém encontrado" : "Nenhum cliente aqui", busca ? "Confira o nome ou os números." : "")}`;
    const ib = el.querySelector("#busca");
    ib.addEventListener("input", debounce(e => { busca = e.target.value; const p = ib.selectionStart; desenha(); const n = el.querySelector("#busca"); n.focus(); n.setSelectionRange(p, p); }, 200));
    el.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => { filtro = b.dataset.f; desenha(); }));
    el.querySelectorAll("[data-o]").forEach(b => b.addEventListener("click", () => { ordem = b.dataset.o; desenha(); }));
    el.querySelector("#novo").addEventListener("click", () => novoClienteRapido(c => ir("dono/cliente/" + c.id)));
    el.querySelector("#csv").addEventListener("click", () => planilha(l, st));
  };

  function planilha(l, st) {
    const linhas = [["Nome", "CPF", "Nascimento", "Celular", "E-mail", "Origem", "Visitas", "Total gasto", "Última visita"]];
    l.forEach(c => { const s = st[c.id] || {}; linhas.push([c.nome, c.cpf, dataCurta(c.nascimento), c.telefone, c.email, c.manual ? "Balcão" : "App", s.visitas || 0, String(s.gasto || 0).replace(".", ","), dataCurta(s.ultima)]); });
    const csv = "﻿" + linhas.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `clientes-barbearia-${hoje()}.csv`; a.click();
  }

  paradas.push(D.ouvir("clientes", [], l => { clientes = l; desenha(); }));
  paradas.push(D.ouvir("agendamentos", [], l => { ags = l; desenha(); }));
  desenha();
  return () => paradas.forEach(f => f());
}
