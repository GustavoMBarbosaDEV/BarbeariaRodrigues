// Ficha do cliente: dados completos, histórico, anotações internas e contato
import { D, traduzErro } from "../dados.js";
import { esc, icone, reais, avatar, foneFormata, cpfFormata, cpfValido, soDigitos, dataCurta, idade, linkWhats, toast, abreModal, confirma, quando, tempoAtras, hoje, vazio } from "../util.js";
import { STATUS } from "../agenda.js";
import { STATUS_PEDIDO } from "../cliente/carrinho.js";
import { N } from "../notificacoes.js";
import { ir } from "../app.js";

export function tela(el, rota) {
  const id = rota.param;
  let c, ags = [], peds = [], ficha = {}, carregado = false;
  const paradas = [];

  const desenha = () => {
    if (!carregado) { el.innerHTML = `<div class="carregando"><span></span></div>`; return; }
    if (!c) { el.innerHTML = `<a class="voltar" href="#/dono/clientes">${icone("voltar")} Clientes</a>` + vazio("usuario", "Cliente não encontrado", "O cadastro pode ter sido apagado pelo próprio cliente."); return; }
    const feitos = ags.filter(a => a.status === "concluido");
    const gasto = feitos.reduce((s, a) => s + Number(a.total || 0), 0) + peds.filter(p => p.status === "retirado").reduce((s, p) => s + Number(p.total || 0), 0);
    const faltas = ags.filter(a => a.status === "faltou").length;
    const serv = {}; feitos.forEach(a => (a.servicos || []).forEach(s => serv[s.nome] = (serv[s.nome] || 0) + 1));
    const preferido = Object.entries(serv).sort((a, b) => b[1] - a[1])[0];
    const aniv = c.nascimento && c.nascimento.slice(5) === hoje().slice(5);
    el.innerHTML = `<a class="voltar" href="#/dono/clientes">${icone("voltar")} Clientes</a>
      <div class="perfil-topo">${avatar(c.nome, "", "g")}<div style="min-width:0"><h1>${esc(c.nome)}</h1><p class="muted pequeno">${c.manual ? "Cadastrado no balcão" : "Usa o app"} · desde ${dataCurta(new Date(c.criadoEm || Date.now()).toISOString().slice(0, 10))}</p>${aniv ? `<span class="pill ouro" style="margin-top:6px">🎂 Aniversário hoje</span>` : ""}</div></div>
      <div class="botoes" style="margin-bottom:16px">
        ${c.telefone ? `<a class="btn whats mini" target="_blank" rel="noopener" href="${linkWhats(c.telefone, `Olá, ${c.nome.split(" ")[0]}!`)}">${icone("whats")} WhatsApp</a>` : ""}
        ${!c.manual ? `<button class="btn sec mini" id="msg">${icone("sino")} Mensagem no app</button>` : ""}
        <button class="btn sec mini" id="editar">${icone("lapis")} Editar</button>
      </div>
      <div class="kpis">
        <div class="kpi"><small>Visitas</small><b>${feitos.length}</b></div>
        <div class="kpi ouro"><small>Total gasto</small><b>${reais(gasto)}</b></div>
        <div class="kpi"><small>Ticket médio</small><b>${reais(feitos.length ? feitos.reduce((s, a) => s + a.total, 0) / feitos.length : 0)}</b></div>
        <div class="kpi"><small>Faltas</small><b>${faltas}</b></div>
      </div>
      <section class="secao"><div class="secao-topo"><h2>Dados</h2></div><div class="lista">
        <div class="config-item"><div class="meio"><small>CPF</small><strong>${c.cpf ? esc(cpfFormata(c.cpf)) : "—"}</strong></div></div>
        <div class="config-item"><div class="meio"><small>Nascimento</small><strong>${c.nascimento ? `${dataCurta(c.nascimento)} · ${idade(c.nascimento)} anos` : "—"}</strong></div></div>
        <div class="config-item"><div class="meio"><small>Celular</small><strong>${c.telefone ? esc(foneFormata(c.telefone)) : "—"}</strong></div></div>
        <div class="config-item"><div class="meio"><small>E-mail</small><strong>${esc(c.email || "—")}</strong></div></div>
        ${preferido ? `<div class="config-item"><div class="meio"><small>Serviço preferido</small><strong>${esc(preferido[0])} (${preferido[1]}×)</strong></div></div>` : ""}
      </div></section>
      <section class="secao"><div class="secao-topo"><h2>Anotações internas</h2><span class="muted pequeno">só a equipe vê</span></div>
        <textarea id="notas" placeholder="Ex.: máquina 1 nas laterais, prefere o Arlley, alergia a tal produto…">${esc(ficha.notas || "")}</textarea>
        <div class="botoes" style="margin-top:8px"><button class="btn mini sec" id="salvaNotas" style="flex:0 0 auto">Salvar anotação</button></div>
      </section>
      <section class="secao"><div class="secao-topo"><h2>Histórico</h2></div>
        ${ags.length ? `<div class="lista">${ags.sort((a, b) => (b.data + b.inicio).localeCompare(a.data + a.inicio)).map(a => `<div class="item"><div class="meio"><strong>${esc((a.servicos || []).map(s => s.nome).join(" + "))}</strong><small>${esc(quando(a.data))} ${a.inicio} · ${esc(a.profissionalNome)}</small></div><div class="lado"><span class="preco">${reais(a.total)}</span><span class="pill ${STATUS[a.status]?.c}">${STATUS[a.status]?.t}</span></div></div>`).join("")}</div>` : `<p class="muted">Nenhum agendamento ainda.</p>`}
      </section>
      ${peds.length ? `<section class="secao"><div class="secao-topo"><h2>Compras no shop</h2></div><div class="lista">${peds.map(p => `<div class="item"><div class="meio"><strong>${esc(p.itens.map(i => `${i.qtd}× ${i.nome}`).join(", "))}</strong><small>${tempoAtras(p.criadoEm)}</small></div><div class="lado"><span class="preco">${reais(p.total)}</span><span class="pill ${STATUS_PEDIDO[p.status]?.c}">${STATUS_PEDIDO[p.status]?.t}</span></div></div>`).join("")}</div></section>` : ""}
      <p class="centro" style="margin-top:24px"><button class="btn fantasma mini" id="apagar">${icone("lixo")} Apagar cliente</button></p>`;

    el.querySelector("#salvaNotas").addEventListener("click", async () => {
      try { await D.salvar("fichas", id, { notas: el.querySelector("#notas").value.slice(0, 2000), atualizadoEm: Date.now() }); toast("Anotação salva.", "ok"); } catch (e) { toast(traduzErro(e), "erro"); }
    });
    el.querySelector("#msg")?.addEventListener("click", mensagem);
    el.querySelector("#editar").addEventListener("click", editar);
    el.querySelector("#apagar").addEventListener("click", apagar);
  };

  function mensagem() {
    abreModal({
      titulo: `Mensagem para ${c.nome.split(" ")[0]}`,
      corpo: `<p class="muted" style="margin-bottom:12px">Aparece no sininho do app do cliente (e no celular, se ele ativou as notificações).</p>
        <label class="campo"><span>Título</span><input id="mt" maxlength="60" value="Barbearia Rodrigues"></label>
        <label class="campo"><span>Mensagem</span><textarea id="mx" maxlength="300" placeholder="Ex.: Seu pedido está pronto para retirar!"></textarea></label>`,
      acoes: [{ t: "Cancelar", cls: "sec" }, { t: "Enviar", fn: async m => { const t = m.querySelector("#mx").value.trim(); if (!t) { toast("Escreva a mensagem.", "erro"); return false; } await N.enviar(id, m.querySelector("#mt").value.trim() || "Barbearia Rodrigues", t, "notificacoes"); toast("Mensagem enviada.", "ok"); } }]
    });
  }

  function editar() {
    abreModal({
      titulo: "Editar cliente",
      corpo: `<label class="campo"><span>Nome completo</span><input id="en" maxlength="120" value="${esc(c.nome)}"></label>
        <div class="linha2 quebra"><label class="campo"><span>CPF</span><input id="ec" inputmode="numeric" maxlength="14" value="${esc(cpfFormata(c.cpf || ""))}"></label>
        <label class="campo"><span>Nascimento</span><input id="ed" type="date" max="${hoje()}" value="${esc(c.nascimento || "")}"></label></div>
        <label class="campo"><span>Celular</span><input id="et" type="tel" maxlength="15" value="${esc(foneFormata(c.telefone || ""))}"></label>`,
      aoAbrir: m => { m.querySelector("#ec").addEventListener("input", e => e.target.value = cpfFormata(e.target.value)); m.querySelector("#et").addEventListener("input", e => e.target.value = foneFormata(e.target.value)); },
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Salvar", fn: async m => {
          const nome = m.querySelector("#en").value.trim().replace(/\s+/g, " "), cpf = soDigitos(m.querySelector("#ec").value);
          if (nome.length < 3) { toast("Digite o nome.", "erro"); return false; }
          if (cpf && !cpfValido(cpf)) { toast("CPF inválido.", "erro"); return false; }
          const ops = [{ tipo: "salvar", c: "clientes", id, dados: { nome, cpf, nascimento: m.querySelector("#ed").value, telefone: soDigitos(m.querySelector("#et").value), atualizadoEm: Date.now() } }];
          if (cpf !== (c.cpf || "")) { if (cpf) ops.push({ tipo: "criar", c: "cpfs", id: cpf, dados: { uid: id } }); if (c.cpf) ops.push({ tipo: "apagar", c: "cpfs", id: c.cpf }); }
          try { await D.lote(ops); toast("Cliente atualizado.", "ok"); } catch (e) { toast(/permission|CPF_EM_USO/i.test(e.code || e.message) ? "Este CPF já está em outro cadastro." : traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  async function apagar() {
    if (!await confirma("Apagar cliente?", "Os dados pessoais e a anotação serão apagados. Os atendimentos continuam nos relatórios com o nome.", "Apagar", true)) return;
    try {
      const ops = [{ tipo: "apagar", c: "clientes", id }, { tipo: "apagar", c: "fichas", id }];
      if (c.cpf) ops.push({ tipo: "apagar", c: "cpfs", id: c.cpf });
      await D.lote(ops); toast("Cliente apagado."); ir("dono/clientes");
    } catch (e) { toast(traduzErro(e), "erro"); }
  }

  paradas.push(D.ouvirDoc("clientes", id, d => { c = d; carregado = true; desenha(); }, () => { carregado = true; desenha(); }));
  paradas.push(D.ouvirDoc("fichas", id, d => { ficha = d || {}; if (!el.querySelector("#notas:focus")) desenha(); }));
  paradas.push(D.ouvir("agendamentos", [["uid", "==", id]], l => { ags = l; desenha(); }));
  paradas.push(D.ouvir("pedidos", [["uid", "==", id]], l => { peds = l.sort((a, b) => b.criadoEm - a.criadoEm); desenha(); }));
  desenha();
  return () => paradas.forEach(f => f());
}
