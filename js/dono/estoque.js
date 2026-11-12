// =====================================================================
//  Estoque: controle dos produtos (quantidade, custo, mínimo, entradas e
//  saídas). O que é público (nome, preço, foto) fica em "produtos" e
//  aparece no Shop; quantidade e custo ficam em "estoque", que só o dono lê.
// =====================================================================
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, numero, toast, abreModal, confirma, fotoComprimida, tempoAtras, vazio, normaliza } from "../util.js";
import { titulo, fotoProduto } from "../ui.js";

export const MOTIVOS = {
  compra: { t: "Compra / reposição", s: 1 },
  devolucao: { t: "Devolução de cliente", s: 1 },
  venda: { t: "Venda no balcão", s: -1 },
  shop: { t: "Retirada do Shop", s: -1 },
  uso: { t: "Uso na barbearia", s: -1 },
  perda: { t: "Perda / vencido", s: -1 },
  ajuste: { t: "Contagem (ajuste)", s: 0 }
};

/** Lança uma movimentação e atualiza a quantidade + disponibilidade no Shop. */
export async function movimentar(produtoId, motivo, qtd, obs = "", atual = null) {
  const est = atual || (await D.pegar("estoque", produtoId)) || { quantidade: 0 };
  const antes = Number(est.quantidade) || 0;
  const depois = MOTIVOS[motivo].s === 0 ? qtd : Math.max(0, antes + MOTIVOS[motivo].s * qtd);
  const p = S.produto(produtoId);
  await D.lote([
    { tipo: "salvar", c: "estoque", id: produtoId, dados: { quantidade: depois, atualizadoEm: Date.now() } },
    { tipo: "salvar", c: "produtos", id: produtoId, dados: { disponivel: depois > 0 } },
    { tipo: "criar", c: "movimentos", id: D.novoId(), dados: { produto: produtoId, produtoNome: p ? p.nome : "", motivo, qtd, antes, depois, obs, em: Date.now(), por: D.usuario.uid } }
  ]);
  return depois;
}

export function tela(el) {
  let est = {}, filtro = "todos", busca = "";
  const paradas = [];

  const desenha = () => {
    const prods = S.produtos.map(p => ({ ...p, e: est[p.id] || { quantidade: 0, minimo: 0, custo: 0 } }));
    const t = normaliza(busca);
    let l = prods.filter(p => !t || normaliza(p.nome).includes(t));
    if (filtro === "baixo") l = l.filter(p => Number(p.e.quantidade) > 0 && Number(p.e.quantidade) <= Number(p.e.minimo));
    if (filtro === "zero") l = l.filter(p => Number(p.e.quantidade) <= 0);
    if (filtro === "ocultos") l = l.filter(p => p.ativo === false);
    const valorCusto = prods.reduce((s, p) => s + Number(p.e.quantidade) * Number(p.e.custo || 0), 0);
    const valorVenda = prods.reduce((s, p) => s + Number(p.e.quantidade) * Number(p.preco || 0), 0);
    const baixos = prods.filter(p => Number(p.e.quantidade) <= Number(p.e.minimo)).length;
    el.innerHTML = titulo("Estoque", "Produtos da barbearia e do Shop.", `<div class="botoes"><button class="btn mini sec" id="hist">${icone("lista")} Movimentações</button><button class="btn mini" id="novo">${icone("mais")} Produto</button></div>`) + `
      <div class="kpis" style="margin-bottom:14px">
        <div class="kpi"><small>Produtos</small><b>${prods.length}</b><i>${prods.reduce((s, p) => s + Number(p.e.quantidade), 0)} unidades</i></div>
        <div class="kpi"><small>Valor de custo</small><b>${reais(valorCusto)}</b></div>
        <div class="kpi destaque"><small>Valor de venda</small><b>${reais(valorVenda)}</b><i>lucro previsto ${reais(valorVenda - valorCusto)}</i></div>
        <div class="kpi"><small>Repor</small><b style="color:${baixos ? "var(--aviso)" : "inherit"}">${baixos}</b><i>no mínimo ou abaixo</i></div>
      </div>
      <div class="busca" style="margin-bottom:10px">${icone("busca")}<input type="search" id="busca" placeholder="Buscar produto" value="${esc(busca)}"></div>
      <div class="chips" style="margin-bottom:12px">${[["todos", "Todos"], ["baixo", "Estoque baixo"], ["zero", "Esgotados"], ["ocultos", "Fora do Shop"]].map(([v, t]) => `<button class="chip ${filtro === v ? "ativo" : ""}" data-f="${v}">${t}</button>`).join("")}</div>
      ${l.length ? `<div class="lista">${l.map(p => { const q = Number(p.e.quantidade); const cls = q <= 0 ? "zero" : q <= Number(p.e.minimo) ? "baixo" : ""; return `<div class="item">
        <button class="thumb" data-edit="${esc(p.id)}" style="border:0;cursor:pointer;overflow:hidden" aria-label="Editar ${esc(p.nome)}">${fotoProduto(p)}</button>
        <button class="meio" data-edit="${esc(p.id)}" style="background:none;border:0;text-align:left;cursor:pointer;padding:0;color:var(--txt)"><strong>${esc(p.nome)}</strong><small>Venda ${reais(p.preco)} · custo ${reais(p.e.custo)} · mín. ${p.e.minimo || 0}</small>${p.ativo === false ? `<small><span class="pill">fora do Shop</span></small>` : ""}</button>
        <div class="lado"><span class="estoque-qtd ${cls}">${q}</span><div class="qtd"><button data-mov="${esc(p.id)}" data-tipo="saida" aria-label="Saída">${icone("menos")}</button><button data-mov="${esc(p.id)}" data-tipo="entrada" aria-label="Entrada">${icone("mais")}</button></div></div>
      </div>`; }).join("")}</div>` : vazio("caixa", "Nenhum produto aqui")}`;
    const ib = el.querySelector("#busca");
    ib.addEventListener("input", e => { busca = e.target.value; const p = ib.selectionStart; desenha(); const n = el.querySelector("#busca"); n.focus(); n.setSelectionRange(p, p); });
    el.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => { filtro = b.dataset.f; desenha(); }));
    el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => editar(b.dataset.edit)));
    el.querySelectorAll("[data-mov]").forEach(b => b.addEventListener("click", () => movimento(b.dataset.mov, b.dataset.tipo)));
    el.querySelector("#novo").addEventListener("click", () => editar(null));
    el.querySelector("#hist").addEventListener("click", () => historico());
  };

  function movimento(id, tipo) {
    const p = S.produto(id), e = est[id] || { quantidade: 0 };
    const ops = Object.entries(MOTIVOS).filter(([, m]) => tipo === "entrada" ? m.s >= 0 : m.s <= 0);
    abreModal({
      titulo: `${tipo === "entrada" ? "Entrada" : "Saída"}: ${p.nome}`,
      corpo: `<p class="muted" style="margin-bottom:12px">Agora: <b style="color:var(--txt)">${e.quantidade}</b> unidade(s).</p>
        <label class="campo"><span>Motivo</span><select id="mm">${ops.map(([k, m]) => `<option value="${k}">${m.t}</option>`).join("")}</select></label>
        <label class="campo"><span id="ql">Quantidade</span><input id="mq" type="number" inputmode="numeric" min="0" step="1" value="1"></label>
        <label class="campo"><span>Observação</span><input id="mo" maxlength="120" placeholder="Opcional (ex.: nota fiscal, fornecedor)"></label>`,
      aoAbrir: m => m.querySelector("#mm").addEventListener("change", ev => { m.querySelector("#ql").textContent = ev.target.value === "ajuste" ? "Quantidade contada (fica igual a este número)" : "Quantidade"; if (ev.target.value === "ajuste") m.querySelector("#mq").value = e.quantidade; }),
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Lançar", fn: async m => {
          const q = Math.round(numero(m.querySelector("#mq").value));
          const mot = m.querySelector("#mm").value;
          if (q < 0 || (q === 0 && mot !== "ajuste")) { toast("Quantidade inválida.", "erro"); return false; }
          try { const n = await movimentar(id, mot, q, m.querySelector("#mo").value.trim(), e); toast(`Estoque de ${p.nome}: ${n}`, "ok"); } catch (err) { toast(traduzErro(err), "erro"); return false; }
        }
      }]
    });
  }

  function editar(id) {
    const p = id ? S.produto(id) : { nome: "", categoria: "Cabelo", preco: 0, descricao: "", foto: "", ativo: true };
    const e = id ? (est[id] || {}) : { quantidade: 0, minimo: 2, custo: 0 };
    let foto = p.foto || "";
    const cats = [...new Set(["Cabelo", "Barba", "Fragrâncias", "Acessórios", ...S.produtos.map(x => x.categoria).filter(Boolean)])];
    abreModal({
      titulo: id ? "Editar produto" : "Novo produto",
      corpo: `<div class="foto-edit" style="margin-bottom:14px"><span class="prev" id="prev">${foto ? `<img src="${esc(foto)}" alt="">` : icone("foto")}</span>
          <div><label class="btn mini sec">${icone("foto")} ${foto ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" id="arq" hidden></label>${foto ? `<button class="btn mini fantasma" id="semFoto" type="button">Remover</button>` : ""}<p class="pequeno muted" style="margin-top:6px">A foto é reduzida automaticamente.</p></div></div>
        <label class="campo"><span>Nome *</span><input id="pn" maxlength="80" value="${esc(p.nome)}"></label>
        <div class="linha2"><label class="campo"><span>Categoria</span><input id="pc" list="cats" maxlength="30" value="${esc(p.categoria || "")}"><datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
          <label class="campo"><span>Preço de venda (R$) *</span><input id="pp" inputmode="decimal" value="${String(p.preco || "").replace(".", ",")}"></label></div>
        <div class="linha3"><label class="campo"><span>Custo (R$)</span><input id="pcu" inputmode="decimal" value="${String(e.custo || "").replace(".", ",")}"></label>
          <label class="campo"><span>Mínimo</span><input id="pmi" type="number" min="0" inputmode="numeric" value="${e.minimo ?? 0}"></label>
          ${id ? "" : `<label class="campo"><span>Qtd. inicial</span><input id="pq" type="number" min="0" inputmode="numeric" value="0"></label>`}</div>
        <label class="campo"><span>Descrição (aparece no Shop)</span><textarea id="pd" maxlength="300">${esc(p.descricao || "")}</textarea></label>
        <label class="check"><input type="checkbox" id="pa" ${p.ativo !== false ? "checked" : ""}><span>Mostrar no Shop para os clientes</span></label>
        ${id ? `<p class="centro" style="margin-top:16px"><button class="btn mini fantasma" id="del" type="button" style="color:var(--perigo)!important">${icone("lixo")} Excluir produto</button></p>` : ""}`,
      aoAbrir: (m, fecha) => {
        m.querySelector("#arq").addEventListener("change", async ev => {
          const f = ev.target.files[0]; if (!f) return;
          try { foto = await fotoComprimida(f, 600, .8); m.querySelector("#prev").innerHTML = `<img src="${foto}" alt="">`; } catch (x) { toast("Não consegui abrir essa imagem.", "erro"); }
        });
        m.querySelector("#semFoto")?.addEventListener("click", () => { foto = ""; m.querySelector("#prev").innerHTML = icone("foto"); });
        m.querySelector("#del")?.addEventListener("click", async () => {
          if (!await confirma("Excluir produto?", `${esc(p.nome)} sai do Shop e do estoque. O histórico de movimentações continua.`, "Excluir", true)) return;
          try { await D.lote([{ tipo: "apagar", c: "produtos", id }, { tipo: "apagar", c: "estoque", id }]); toast("Produto excluído."); fecha(); } catch (x) { toast(traduzErro(x), "erro"); }
        });
      },
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Salvar", fn: async m => {
          const v = s => m.querySelector(s)?.value?.trim() ?? "";
          const nome = v("#pn"), preco = numero(v("#pp"));
          if (!nome) { toast("Digite o nome do produto.", "erro"); return false; }
          if (preco <= 0) { toast("Digite o preço de venda.", "erro"); return false; }
          const pid = id || D.novoId();
          const qtd = id ? Number(e.quantidade || 0) : Math.max(0, Math.round(numero(v("#pq"))));
          const pub = { nome, categoria: v("#pc") || "Outros", preco, descricao: v("#pd"), foto, ativo: m.querySelector("#pa").checked, disponivel: qtd > 0, ordem: id ? (p.ordem ?? 999) : S.produtos.length };
          const priv = { custo: numero(v("#pcu")), minimo: Math.max(0, Math.round(numero(v("#pmi")))), quantidade: qtd, atualizadoEm: Date.now() };
          if (foto.length > 900000) { toast("Foto muito grande. Tente outra.", "erro"); return false; }
          try { await D.lote([{ tipo: "salvar", c: "produtos", id: pid, dados: pub }, { tipo: "salvar", c: "estoque", id: pid, dados: priv }]); toast("Produto salvo.", "ok"); }
          catch (x) { toast(traduzErro(x), "erro"); return false; }
        }
      }]
    });
  }

  async function historico() {
    const l = (await D.listar("movimentos").catch(() => [])).sort((a, b) => b.em - a.em).slice(0, 80);
    abreModal({
      titulo: "Movimentações", largo: true,
      corpo: l.length ? `<div class="lista">${l.map(x => { const m = MOTIVOS[x.motivo] || { t: x.motivo, s: 0 }; const dif = x.depois - x.antes; return `<div class="item"><div class="meio"><strong>${esc(x.produtoNome)}</strong><small>${m.t}${x.obs ? " · " + esc(x.obs) : ""} · ${tempoAtras(x.em)}</small></div><div class="lado"><b class="num" style="color:${dif > 0 ? "var(--ok)" : dif < 0 ? "var(--perigo)" : "inherit"}">${dif > 0 ? "+" : ""}${dif}</b><small class="muted">${x.antes} → ${x.depois}</small></div></div>`; }).join("")}</div>` : vazio("lista", "Nenhuma movimentação ainda")
    });
  }

  paradas.push(D.ouvir("estoque", [], l => { est = Object.fromEntries(l.map(e => [e.id, e])); desenha(); }));
  paradas.push(S.ao(q => q === "produtos" && desenha()));
  desenha();
  return () => paradas.forEach(f => f());
}
