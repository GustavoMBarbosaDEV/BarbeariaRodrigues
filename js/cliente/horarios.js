// Meus horários: próximos e anteriores, cancelar, remarcar, avaliar
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, toast, confirma, abreModal, dataDe, DIAS_C, MESES, quando, vazio, primeiroNome, linkWhats } from "../util.js";
import { STATUS, ATIVOS, podeCancelar, liberar, arquivoCalendario, passou } from "../agenda.js";
import { titulo } from "../ui.js";

export function tela(el) {
  let aba = "proximos", lista = null, avaliados = new Set();
  const paradas = [];

  const card = a => {
    const d = dataDe(a.data), st = STATUS[a.status] || STATUS.marcado;
    const futuro = ATIVOS.includes(a.status) && !passou(a);
    const loja = S.loja || {};
    return `<div class="horario-card">
      <div class="data-bloco"><small>${DIAS_C[d.getDay()]}</small><b>${d.getDate()}</b><small>${MESES[d.getMonth()].slice(0, 3)}</small></div>
      <div class="meio">
        <span class="pill ${st.c}">${st.t}</span>
        <strong style="margin-top:6px">${esc((a.servicos || []).map(s => s.nome).join(" + "))}</strong>
        <small>${esc(quando(a.data))} · ${a.inicio}–${a.fim || ""} · ${esc(a.profissionalNome || "")}</small>
        <small>${reais(a.total)}${a.obs ? ` · “${esc(a.obs)}”` : ""}</small>
        <div class="botoes">
          ${futuro ? `<button class="btn mini sec" data-cal="${a.id}">${icone("calendario")} Agenda</button>` : ""}
          ${futuro && podeCancelar(a) ? `<a class="btn mini sec" href="#/agendar?remarcar=${a.id}">${icone("repetir")} Remarcar</a><button class="btn mini fantasma" data-cancela="${a.id}">Cancelar</button>` : ""}
          ${futuro && !podeCancelar(a) && loja.whatsapp ? `<a class="btn mini sec" target="_blank" rel="noopener" href="${linkWhats(loja.whatsapp, `Olá! Preciso falar sobre meu horário de ${quando(a.data).toLowerCase()} às ${a.inicio}.`)}">${icone("whats")} Falar com a barbearia</a>` : ""}
          ${a.status === "concluido" && !avaliados.has(a.id) ? `<button class="btn mini" data-avalia="${a.id}">${icone("estrela")} Avaliar</button>` : ""}
          ${!futuro ? `<a class="btn mini sec" href="#/agendar?${(a.servicos || []).length === 1 ? "servico=" + encodeURIComponent(a.servicos[0].id) + "&" : ""}prof=${encodeURIComponent(a.profissional)}">Agendar de novo</a>` : ""}
        </div>
      </div>
    </div>`;
  };

  const desenha = () => {
    if (!lista) { el.innerHTML = titulo("Meus horários") + `<div class="carregando"><span></span></div>`; return; }
    const prox = lista.filter(a => ATIVOS.includes(a.status) && !passou(a)).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    const ant = lista.filter(a => !prox.includes(a)).sort((a, b) => (b.data + b.inicio).localeCompare(a.data + a.inicio));
    const mostra = aba === "proximos" ? prox : ant;
    el.innerHTML = titulo("Meus horários", "", `<a class="btn mini" href="#/agendar">${icone("mais")} Novo</a>`) + `
      <div class="seg" role="tablist" style="margin-bottom:14px">
        <button class="${aba === "proximos" ? "ativo" : ""}" data-aba="proximos" role="tab">Próximos (${prox.length})</button>
        <button class="${aba === "anteriores" ? "ativo" : ""}" data-aba="anteriores" role="tab">Anteriores (${ant.length})</button>
      </div>
      ${mostra.length ? `<div class="lista">${mostra.map(card).join("")}</div>` : aba === "proximos"
        ? vazio("calendario", "Nenhum horário marcado", "Que tal deixar o visual em dia?", `<a class="btn" href="#/agendar">Agendar agora</a>`)
        : vazio("relogio", "Nenhum atendimento anterior")}`;
    el.querySelectorAll("[data-aba]").forEach(b => b.addEventListener("click", () => { aba = b.dataset.aba; desenha(); }));
    el.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("click", () => arquivoCalendario(lista.find(a => a.id === b.dataset.cal))));
    el.querySelectorAll("[data-cancela]").forEach(b => b.addEventListener("click", () => cancelar(lista.find(a => a.id === b.dataset.cancela))));
    el.querySelectorAll("[data-avalia]").forEach(b => b.addEventListener("click", () => avaliar(lista.find(a => a.id === b.dataset.avalia))));
  };

  async function cancelar(a) {
    if (!await confirma("Cancelar horário?", `${esc(quando(a.data))} às ${a.inicio} com ${esc(a.profissionalNome)}. O horário fica livre para outra pessoa.`, "Cancelar horário", true)) return;
    try { await liberar(a, "cancelado", { canceladoPor: "cliente" }); toast("Horário cancelado.", "ok"); }
    catch (e) { toast(traduzErro(e), "erro"); }
  }

  function avaliar(a) {
    let nota = 5;
    abreModal({
      titulo: "Como foi o atendimento?",
      corpo: `<p class="muted centro" style="margin-bottom:12px">${esc((a.servicos || []).map(s => s.nome).join(" + "))} com ${esc(a.profissionalNome)}</p>
        <div class="escolha-nota" role="radiogroup" aria-label="Nota">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-n="${i}" class="on" role="radio" aria-label="${i} estrela${i > 1 ? "s" : ""}"><svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}</div>
        <label class="campo" style="margin-top:14px"><span>Quer deixar um comentário? (aparece no app)</span><textarea id="txt" maxlength="400" placeholder="Conte como foi"></textarea></label>`,
      aoAbrir: m => m.querySelectorAll("[data-n]").forEach(b => b.addEventListener("click", () => { nota = Number(b.dataset.n); m.querySelectorAll("[data-n]").forEach(x => x.classList.toggle("on", Number(x.dataset.n) <= nota)); })),
      acoes: [{ t: "Agora não", cls: "sec" }, {
        t: "Enviar avaliação", fn: async m => {
          try {
            await D.salvar("avaliacoes", a.id, {
              uid: D.usuario.uid, nome: (primeiroNome((S.perfil && S.perfil.nome) || D.usuario.nome) || "Cliente").slice(0, 40), nota,
              texto: m.querySelector("#txt").value.trim().slice(0, 400), servico: (a.servicos || []).map(s => s.nome).join(" + "),
              profissional: a.profissional, profissionalNome: a.profissionalNome || "", ag: a.id, em: Date.now()
            }, false);
            toast("Obrigado pela avaliação!", "ok");
          } catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  paradas.push(D.ouvir("agendamentos", [["uid", "==", D.usuario.uid]], l => { lista = l; desenha(); }, e => { toast(traduzErro(e), "erro"); lista = []; desenha(); }));
  paradas.push(D.ouvir("avaliacoes", [["uid", "==", D.usuario.uid]], l => { avaliados = new Set(l.map(a => a.id)); desenha(); }));
  desenha();
  return () => paradas.forEach(f => f());
}
