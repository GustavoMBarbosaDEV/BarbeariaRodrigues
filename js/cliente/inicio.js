// Início do cliente: vitrine da barbearia (estilo página do estabelecimento)
import { D } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, estrelas, avatar, linkWhats, hoje, quando, tempoAtras, primeiroNome } from "../util.js";
import { cartaoServico, situacaoAgora, tabelaHorario, enderecoLink, fotoProduto, lightbox } from "../ui.js";
import { ATIVOS } from "../agenda.js";
import { reais } from "../util.js";

export function tela(el) {
  let avaliacoes = [];
  let proximo = null;
  const paradas = [];

  const desenha = () => {
    const loja = S.loja || {};
    const sit = situacaoAgora();
    const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : 0;
    const destaques = S.servicos.filter(s => s.ativo !== false && s.destaque);
    const lista = destaques.length ? destaques : S.servicos.filter(s => s.ativo !== false).slice(0, 6);
    const aviso = S.avisos.find(a => !a.ate || a.ate >= hoje());
    const nome = D.usuario && S.perfil ? primeiroNome(S.perfil.nome) : "";
    const prods = S.produtos.filter(p => p.ativo !== false).slice(0, 4);

    el.innerHTML = `
    <section class="hero">
      <img src="img/casa/equipe.jpg" alt="Equipe da Barbearia Rodrigues">
      <div class="hero-txt">
        <img class="logo-g" src="img/logo-320.png" alt="" width="76" height="76">
        <h1>${esc(loja.nome || "Barbearia Rodrigues")}</h1>
        <p>${esc(loja.slogan || "")}</p>
        <div class="hero-info">
          <span class="aberto-agora ${sit.aberto ? "" : "fechado"}">${esc(sit.texto)}</span>
          ${avaliacoes.length ? `<span>${estrelas(media)} <b>${media.toFixed(1).replace(".", ",")}</b> (${avaliacoes.length})</span>` : ""}
          ${loja.cidade ? `<span>${icone("local")}${esc(loja.cidade.split(",")[0])}</span>` : ""}
        </div>
        <div class="botoes">
          <a class="btn" href="#/agendar">${icone("calendario")} Agendar horário</a>
          ${loja.whatsapp ? `<a class="btn sec" href="${linkWhats(loja.whatsapp, "Olá! Vim pelo app da Barbearia Rodrigues.")}" target="_blank" rel="noopener">${icone("whats")} WhatsApp</a>` : ""}
        </div>
      </div>
    </section>

    ${nome ? `<p class="muted" style="margin-top:18px">Olá, <b style="color:var(--txt)">${esc(nome)}</b>! Bom te ver por aqui.</p>` : ""}

    ${proximo ? `<div class="secao" style="margin-top:16px"><a class="faixa" href="#/horarios">${icone("calendario")}<div><strong>Seu próximo horário: ${esc(quando(proximo.data))} às ${proximo.inicio}</strong><p>${esc((proximo.servicos || []).map(s => s.nome).join(" + "))} com ${esc(proximo.profissionalNome || "a equipe")}</p></div></a></div>` : ""}

    ${aviso ? `<div class="secao" style="margin-top:16px"><div class="faixa">${icone("megafone")}<div><strong>${esc(aviso.titulo)}</strong><p>${esc(aviso.texto)}</p></div></div></div>` : ""}

    <section class="secao">
      <div class="secao-topo"><h2>Serviços populares</h2><a href="#/servicos">Ver todos</a></div>
      <div class="rolagem">${lista.map(cartaoServico).join("")}</div>
    </section>

    <section class="secao">
      <div class="secao-topo"><h2>Nossos trabalhos</h2><a href="#/galeria">Ver galeria</a></div>
      <div class="galeria" id="gal">${S.galeria.slice(0, 6).map((g, i) => `<button data-i="${i}"><img src="${esc(g.foto)}" alt="${esc(g.titulo)}" loading="lazy"><span>${esc(g.titulo)}</span></button>`).join("")}</div>
    </section>

    ${S.profissionais.filter(p => p.ativo !== false).length ? `<section class="secao">
      <div class="secao-topo"><h2>Equipe</h2></div>
      <div class="rolagem">${S.profissionais.filter(p => p.ativo !== false).map(p => `<a class="pessoa" href="#/agendar?prof=${encodeURIComponent(p.id)}">${avatar(p.nome, p.foto)}<strong>${esc(p.nome)}</strong><small>${esc(p.funcao || "Barbeiro")}</small></a>`).join("")}</div>
    </section>` : ""}

    ${prods.length ? `<section class="secao">
      <div class="secao-topo"><h2>Shop</h2><a href="#/shop">Ver produtos</a></div>
      <div class="produtos">${prods.map(p => `<a class="produto" href="#/shop?p=${encodeURIComponent(p.id)}" style="color:var(--txt)"><div class="foto">${fotoProduto(p)}</div><div class="corpo"><strong>${esc(p.nome)}</strong><span class="preco">${reais(p.preco)}</span></div></a>`).join("")}</div>
    </section>` : ""}

    <section class="secao">
      <div class="secao-topo"><h2>Avaliações</h2></div>
      ${avaliacoes.length ? `<div class="card"><div class="nota-grande"><b>${media.toFixed(1).replace(".", ",")}</b><div>${estrelas(media)}<div class="muted pequeno">${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação" : "avaliações"}</div></div></div></div>
        <div class="lista" style="margin-top:10px">${avaliacoes.slice(0, 5).map(a => `<div class="avaliacao"><div class="avaliacao-topo"><strong>${esc(primeiroNome(a.nome) || "Cliente")}</strong>${estrelas(a.nota)}</div>${a.texto ? `<p>${esc(a.texto)}</p>` : ""}<small class="fraco">${esc((a.servico || "") + (a.profissionalNome ? " · com " + a.profissionalNome : ""))} · ${tempoAtras(a.em)}</small></div>`).join("")}</div>`
        : `<div class="card"><p class="muted">Ainda não há avaliações pelo app. Depois do seu atendimento, conte para a gente como foi!</p></div>`}
    </section>

    <section class="secao info-grid">
      <div class="card">
        <h3 style="margin-bottom:10px">Horário de funcionamento</h3>
        ${tabelaHorario(loja.horario)}
      </div>
      <div class="card">
        <h3 style="margin-bottom:10px">Onde estamos</h3>
        <p>${esc(loja.endereco || "")}<br><span class="muted">${esc(loja.cidade || "")}</span></p>
        <div class="botoes" style="margin-top:14px">
          <a class="btn sec mini" href="${enderecoLink(loja)}" target="_blank" rel="noopener">${icone("local")} Ver no mapa</a>
          ${loja.instagram ? `<a class="btn sec mini" href="https://instagram.com/${esc(loja.instagram)}" target="_blank" rel="noopener">${icone("insta")} Instagram</a>` : ""}
          ${loja.whatsapp ? `<a class="btn sec mini" href="${linkWhats(loja.whatsapp)}" target="_blank" rel="noopener">${icone("whats")} WhatsApp</a>` : ""}
        </div>
        ${loja.sobre ? `<p class="muted pequeno" style="margin-top:14px">${esc(loja.sobre)}</p>` : ""}
      </div>
    </section>`;

    el.querySelectorAll("#gal button").forEach(b => b.addEventListener("click", () => lightbox(S.galeria, Number(b.dataset.i))));
  };

  paradas.push(S.ao(q => { if (["loja", "servicos", "profissionais", "galeria", "avisos", "produtos", "perfil"].includes(q)) desenha(); }));
  paradas.push(D.ouvir("avaliacoes", [], l => { avaliacoes = l.filter(a => a.publica !== false).sort((a, b) => b.em - a.em); desenha(); }));
  if (D.usuario) paradas.push(D.ouvir("agendamentos", [["uid", "==", D.usuario.uid]], l => {
    proximo = l.filter(a => ATIVOS.includes(a.status) && a.data >= hoje()).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))[0] || null;
    desenha();
  }));
  desenha();
  return () => paradas.forEach(f => f());
}
