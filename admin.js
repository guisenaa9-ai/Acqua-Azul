const { supabaseUrl, supabaseKey } = window.ACQUA;
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
const $ = (id) => document.getElementById(id);
const tela = (nome) => document.querySelector(`[data-tela="${nome}"]`);
const urlFoto = (caminho) => `${supabaseUrl}/storage/v1/object/public/fotos/${caminho}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS = [["novo", "Novo"], ["em_contato", "Em contato"], ["agendado", "Aula agendada"], ["matriculou", "Matriculou"], ["desistiu", "Desistiu"]];
let papel = null;
const ABAS_RECEPCAO = ["resumo", "pedidos", "turmas", "alunos"];
const telefoneBonito = (t) => (t.length >= 12 ? `(${t.slice(2, 4)}) ${t.slice(4, -4)}-${t.slice(-4)}` : t);
const telefoneCampo = (t) => (t.length === 10 || t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, -4)}-${t.slice(-4)}` : telefoneBonito(t));
const cpfBonito = (c) => (c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c);
function cpfValido(c) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    return ((s * 10) % 11) % 10;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
const STATUS_ALUNO = [["ativa", "Matrícula ativa"], ["trancada", "Trancada"], ["cancelada", "Cancelada"]];
let turmasCache = [];
const rotuloTurma = (t) => `${t.nome} – ${t.unidade} – ${t.dias} ${t.horario}`;

// Campos de cada tabela editável. t: tipo do campo; r: rótulo.
const TABELAS = {
  pedidos: {
    ordem: [["criado_em", { ascending: false }]],
    nome: (x) => `o pedido de ${x.responsavel}`,
    info: (x) => `<div class="info">
      <p class="quando">${new Date(x.criado_em).toLocaleString("pt-BR", { timeZone: "America/Manaus", dateStyle: "short", timeStyle: "short" })}</p>
      <h3>${esc(x.responsavel)}</h3>
      <p><b>Criança:</b> ${esc(x.crianca)}</p>
      <p><b>Turma:</b> ${esc(x.turma_texto)}</p>
      <p><b>Telefone:</b> ${esc(telefoneBonito(x.telefone))}</p>
      <div class="contato">
        <a class="btn btn-mar" href="https://wa.me/${esc(x.telefone)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn-contorno" href="tel:+${esc(x.telefone)}">Ligar</a>
      </div>
    </div>`,
    campos: [
      { n: "status", r: "Situação", t: "select", op: STATUS },
      { n: "anotacao", r: "Anotações", t: "textarea", max: 1000, largo: true, ph: "ex: Ligou dia 12, aula marcada para sábado 8h" }
    ]
  },
  turmas: {
    ordem: [["ordem"], ["id"]],
    novo: { unidade: "Cidade Nova", vagas: 8, total: 8, ordem: 0, ativa: true },
    vagas: true,
    nome: (x) => x.nome,
    validar: (x) => (x.vagas > x.total ? "Vagas livres não podem passar do total." : ""),
    campos: [
      { n: "nome", r: "Nome da turma", max: 60, req: true },
      { n: "unidade", r: "Unidade", t: "select", op: ["Cidade Nova", "Campos Elíseos"] },
      { n: "idade", r: "Idade", max: 60, req: true, ph: "ex: 2 a 4 anos" },
      { n: "dias", r: "Dias", max: 60, req: true, ph: "ex: Seg e Qua" },
      { n: "horario", r: "Horário", max: 20, req: true, ph: "ex: 16h" },
      { n: "vagas", r: "Vagas livres", t: "number", min: 0, req: true },
      { n: "total", r: "Total de vagas", t: "number", min: 1, req: true },
      { n: "ordem", r: "Ordem no site", t: "number" },
      { n: "ativa", r: "Aparece no site", t: "checkbox" }
    ]
  },
  marcos: {
    ordem: [["ordem"], ["id"]],
    novo: { ordem: 0 },
    nome: (x) => `${x.ano} – ${x.titulo}`,
    campos: [
      { n: "ano", r: "Ano", max: 20, req: true, ph: "ex: 2018 ou Hoje" },
      { n: "titulo", r: "Título", max: 80, req: true },
      { n: "ordem", r: "Ordem", t: "number" },
      { n: "texto", r: "Texto", t: "textarea", max: 600, largo: true }
    ]
  },
  avisos: {
    ordem: [["criado_em", { ascending: false }]],
    novo: { ativo: true },
    nome: (x) => x.texto,
    campos: [
      { n: "texto", r: "Texto do aviso", t: "textarea", max: 140, req: true, largo: true, ph: "ex: Matrículas de férias abertas!" },
      { n: "ate", r: "Mostrar até (opcional)", t: "date" },
      { n: "ativo", r: "Aparece no site", t: "checkbox" }
    ]
  },
  planos: {
    ordem: [["ordem"], ["id"]],
    novo: { ordem: 0, ativo: true, destaque: false },
    nome: (x) => x.nome,
    campos: [
      { n: "nome", r: "Nome do plano", max: 60, req: true, ph: "ex: 2x por semana" },
      { n: "preco", r: "Preço", max: 40, req: true, ph: "ex: R$ 250/mês" },
      { n: "ordem", r: "Ordem", t: "number" },
      { n: "descricao", r: "Descrição (opcional)", t: "textarea", max: 400, largo: true, ph: "ex: Aulas de 45 minutos, turmas de até 8 crianças" },
      { n: "destaque", r: "Destacar como \"Mais escolhido\"", t: "checkbox" },
      { n: "ativo", r: "Aparece no site", t: "checkbox" }
    ]
  },
  depoimentos: {
    ordem: [["ordem"], ["id"]],
    novo: { ordem: 0, ativo: true },
    nome: (x) => `o depoimento de ${x.nome}`,
    campos: [
      { n: "nome", r: "Nome", max: 60, req: true, ph: "ex: Juliana" },
      { n: "relacao", r: "Quem é (opcional)", max: 80, ph: "ex: mãe da Helena, 3 anos" },
      { n: "ordem", r: "Ordem", t: "number" },
      { n: "texto", r: "Depoimento", t: "textarea", max: 500, req: true, largo: true },
      { n: "ativo", r: "Aparece no site", t: "checkbox" }
    ]
  },
  alunos: {
    nome: (x) => `a ficha de ${x.nome}`,
    aoCriar: (novo) => abrirFicha(novo),
    aoSalvar: (d) => {
      Object.assign(fichaAtual, d);
      atualizarCabecalhoFicha(d);
    },
    aoApagar: () => voltarParaAlunos(),
    campos: [
      { n: "nome", r: "Nome do aluno", max: 100, req: true },
      { n: "nascimento", r: "Data de nascimento", t: "date" },
      { n: "turma_id", r: "Turma", t: "select", num: true, op: () => [["", "Sem turma"], ...turmasCache.map((t) => [String(t.id), rotuloTurma(t)])] },
      { n: "status", r: "Situação da matrícula", t: "select", op: STATUS_ALUNO },
      { n: "inicio", r: "Início da matrícula", t: "date", req: true },
      { n: "plano", r: "Plano", max: 80, ph: "ex: 2x por semana" },
      { n: "emergencia", r: "Contato de emergência", max: 150, ph: "Nome e telefone" },
      { n: "endereco", r: "Endereço", t: "textarea", max: 300, largo: true },
      { n: "observacoes", r: "Observações (ex.: alergias ou cuidados especiais, só se necessário)", t: "textarea", max: 1000, largo: true }
    ]
  },
  responsaveis: {
    fixos: ["aluno_id"],
    nome: (x) => x.nome,
    recarregar: () => carregarResponsaveis(fichaAtual.id),
    validar: (x) => (x.cpf && !cpfValido(x.cpf) ? "CPF inválido. Confira os números." : x.telefone && !/^\d{10,13}$/.test(x.telefone) ? "Confira o telefone com DDD." : ""),
    campos: [
      { n: "nome", r: "Nome", max: 100, req: true },
      { n: "parentesco", r: "Parentesco", max: 40, ph: "ex: mãe, pai, avó" },
      { n: "cpf", r: "CPF", digitos: true, max: 14, ph: "000.000.000-00", mostrar: cpfBonito },
      { n: "telefone", r: "Telefone", t: "tel", digitos: true, max: 20, ph: "(92) 99999-9999", mostrar: telefoneCampo },
      { n: "email", r: "E-mail", t: "email", max: 120 },
      { n: "financeiro", r: "Responsável financeiro", t: "checkbox" }
    ]
  },
  fotos: {
    ordem: [["ordem"], ["id"]],
    nome: (x) => x.legenda || "esta foto",
    foto: true,
    campos: [
      { n: "legenda", r: "Legenda (opcional)", max: 120, largo: true },
      { n: "ordem", r: "Ordem", t: "number" },
      { n: "ativa", r: "Aparece no site", t: "checkbox" }
    ]
  }
};

const TEXTOS = [
  { chave: "whatsapp", r: "WhatsApp da escola", ajuda: "Só números, com 55 e o DDD. Ex: 5592991234567", padrao: "\\d{12,13}", req: true },
  { chave: "hero_texto", r: "Frase de abertura", t: "textarea", max: 300 },
  { chave: "desde", r: "Ano de fundação", max: 10 },
  { chave: "idade_inicial", r: "Idade mínima para começar", ph: "ex: 6 meses", max: 30 },
  { chave: "seguidores", r: "Seguidores no Instagram", ph: "ex: 23 mil", max: 30 },
  { chave: "horario", r: "Dias e horário de funcionamento", ph: "ex: Seg a Sáb, das 7h às 20h", max: 120 },
  { chave: "formas_pagamento", r: "Formas de pagamento", ph: "ex: Pix, cartão de crédito e boleto", max: 200 },
  { chave: "escola_razao", r: "Documentos · Razão social da escola", max: 150 },
  { chave: "escola_cnpj", r: "Documentos · CNPJ", max: 20, ph: "00.000.000/0000-00" },
  { chave: "escola_endereco", r: "Documentos · Endereço da escola", max: 200 },
  { chave: "escola_responsavel", r: "Documentos · Quem assina (nome e cargo)", max: 120, ph: "ex: Maria Silva – Diretora" },
  { chave: "end_cidade_nova", r: "Endereço da unidade Cidade Nova", t: "textarea", max: 200 },
  { chave: "end_campos_eliseos", r: "Endereço da unidade Campos Elíseos", t: "textarea", max: 200 }
];

function criarCampo(def, valor) {
  const label = document.createElement("label");
  if (def.largo || def.t === "textarea") label.className = "largo";
  let input;
  if (def.t === "select") {
    input = document.createElement("select");
    (typeof def.op === "function" ? def.op() : def.op).forEach((o) => (Array.isArray(o) ? input.add(new Option(o[1], o[0])) : input.add(new Option(o))));
  } else if (def.t === "textarea") {
    input = document.createElement("textarea");
    input.rows = 3;
  } else {
    input = document.createElement("input");
    input.type = def.t || "text";
  }
  input.name = def.n || def.chave;
  if (def.max) input.maxLength = def.max;
  if (def.min != null) input.min = def.min;
  if (def.req) input.required = true;
  if (def.ph) input.placeholder = def.ph;
  if (def.padrao) input.pattern = def.padrao;
  if (def.t === "checkbox") {
    input.checked = Boolean(valor);
    label.className = "check";
    label.append(input, " " + def.r);
  } else {
    input.value = def.mostrar && valor ? def.mostrar(valor) : (valor ?? "");
    label.append(def.r, input);
  }
  if (def.ajuda) {
    const s = document.createElement("small");
    s.textContent = def.ajuda;
    label.append(s);
  }
  return label;
}

function lerCampos(form, campos) {
  const dados = {};
  for (const c of campos) {
    const el = form.elements[c.n];
    if (c.t === "checkbox") dados[c.n] = el.checked;
    else if (c.t === "number") dados[c.n] = Number(el.value) || 0;
    else if (c.t === "date") dados[c.n] = el.value || null;
    else if (c.num) dados[c.n] = Number(el.value) || null;
    else if (c.digitos) dados[c.n] = el.value.replace(/\D/g, "");
    else dados[c.n] = el.value.trim();
  }
  return dados;
}

function avisar(el, msg) {
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.textContent = ""), 3500);
}

function botao(texto, classe, acao) {
  const b = document.createElement("button");
  b.type = acao === "salvar" ? "submit" : "button";
  b.className = `btn ${classe}`;
  b.textContent = texto;
  if (acao !== "salvar") b.dataset.acao = acao;
  return b;
}

// Um cartão editável para uma linha de qualquer tabela
function cartao(tabela, item) {
  const cfg = TABELAS[tabela];
  const nova = !item.id;
  const form = document.createElement("form");
  form.className = "admin-cartao" + (nova ? " nova" : "");
  const status = Object.assign(document.createElement("span"), { className: "status" });
  status.setAttribute("role", "status");

  if (cfg.info) form.insertAdjacentHTML("beforeend", cfg.info(item));
  if (item.status) form.dataset.status = item.status;
  if (cfg.foto) {
    const img = Object.assign(document.createElement("img"), { src: urlFoto(item.caminho), alt: item.legenda || "Foto enviada", className: "previa", loading: "lazy" });
    form.append(img);
  }
  if (cfg.vagas) {
    form.insertAdjacentHTML("beforeend", `<div class="vagas-ctrl">
      <button type="button" class="btn-redondo" data-acao="menos" aria-label="Uma vaga a menos">−</button>
      <div><strong data-campo="vagas"></strong><span>vagas livres</span></div>
      <button type="button" class="btn-redondo" data-acao="mais" aria-label="Uma vaga a mais">+</button>
    </div>`);
  }
  const campos = document.createElement("div");
  campos.className = "campos";
  cfg.campos.forEach((c) => campos.append(criarCampo(c, item[c.n])));
  const botoes = document.createElement("div");
  botoes.className = "botoes";
  botoes.append(botao("Salvar", "btn-mar", "salvar"), botao("Apagar", "btn-apagar", "apagar"), status);
  if (tabela === "turmas" && papel !== "dono") botoes.querySelector('[data-acao="apagar"]').remove(); // recepção não apaga turma
  form.append(campos, botoes);

  const pintar = () => {
    const ativo = form.elements.ativa || form.elements.ativo;
    form.classList.toggle("inativa", ativo ? !ativo.checked : false);
    if (!cfg.vagas) return;
    const v = Number(form.elements.vagas.value), tot = Number(form.elements.total.value);
    form.querySelector('[data-campo="vagas"]').textContent = `${v} de ${tot}`;
    form.querySelector('[data-acao="menos"]').disabled = nova || v <= 0;
    form.querySelector('[data-acao="mais"]').disabled = nova || v >= tot;
  };
  pintar();
  form.addEventListener("input", pintar);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = lerCampos(form, cfg.campos);
    const invalido = cfg.validar?.(dados);
    if (invalido) return avisar(status, invalido);
    if (nova) cfg.fixos?.forEach((k) => (dados[k] = item[k]));
    const { data: salvo, error } = nova ? await sb.from(tabela).insert(dados).select().single() : await sb.from(tabela).update(dados).eq("id", item.id);
    if (error) return avisar(status, "Não salvou. Confira os campos e tente de novo.");
    avisar(status, "Salvo!");
    if (nova && cfg.aoCriar) return cfg.aoCriar(salvo);
    cfg.aoSalvar?.(dados);
    if (dados.status) {
      form.dataset.status = dados.status;
      filtrarPedidos();
    }
    if (nova) cfg.recarregar ? cfg.recarregar() : carregarLista(tabela);
  });

  form.addEventListener("click", async (e) => {
    const acao = e.target.dataset?.acao;
    if (acao === "menos" || acao === "mais") {
      const v = Number(form.elements.vagas.value) + (acao === "mais" ? 1 : -1);
      const { error } = await sb.from(tabela).update({ vagas: v }).eq("id", item.id);
      if (error) return avisar(status, "Não salvou. Tente de novo.");
      form.elements.vagas.value = v;
      pintar();
      avisar(status, "Vagas atualizadas!");
    }
    if (acao === "apagar") {
      if (nova) return form.remove();
      if (!confirm(`Apagar "${cfg.nome(item)}" de vez?${"ativa" in item || "ativo" in item ? ' Se for só esconder do site, desmarque "Aparece no site".' : ""}`)) return;
      const { error } = await sb.from(tabela).delete().eq("id", item.id);
      if (error) return avisar(status, "Não apagou. Tente de novo.");
      if (cfg.foto) await sb.storage.from("fotos").remove([item.caminho]);
      form.remove();
      cfg.aoApagar?.(item);
    }
  });
  return form;
}

async function carregarLista(tabela) {
  const sec = tela(tabela);
  const erro = sec.querySelector(".erro");
  erro.textContent = "";
  let q = sb.from(tabela).select("*");
  for (const [col, opc] of TABELAS[tabela].ordem) q = q.order(col, opc);
  const { data, error } = await q;
  if (error) return (erro.textContent = "Não foi possível carregar. Recarregue a página.");
  sec.querySelector("[data-lista]").replaceChildren(...data.map((x) => cartao(tabela, x)));
  if (!data.length) sec.querySelector("[data-lista]").innerHTML = '<p class="dica">Nada por aqui ainda.</p>';
  if (tabela === "pedidos") filtrarPedidos();
}

function filtrarPedidos() {
  const f = $("filtro-pedidos").value;
  tela("pedidos").querySelectorAll("[data-lista] .admin-cartao").forEach((c) => (c.hidden = Boolean(f) && c.dataset.status !== f));
}
$("filtro-pedidos").addEventListener("change", filtrarPedidos);

document.querySelectorAll("[data-novo]").forEach((b) =>
  b.addEventListener("click", () => {
    const tabela = b.dataset.novo;
    const lista = tela(tabela).querySelector("[data-lista]");
    lista.querySelector(":scope > p.dica")?.remove();
    const form = cartao(tabela, { ...TABELAS[tabela].novo });
    lista.prepend(form);
    form.querySelector("input, textarea")?.focus();
  })
);

// Textos soltos do site
async function carregarTextos() {
  const form = $("form-textos");
  const { data, error } = await sb.from("conteudo").select("chave,valor");
  if (error) return (form.textContent = "Não foi possível carregar os textos. Recarregue a página.");
  const valores = Object.fromEntries(data.map((x) => [x.chave, x.valor]));
  const campos = document.createElement("div");
  campos.className = "campos";
  TEXTOS.forEach((t) => campos.append(criarCampo(t, valores[t.chave])));
  const status = Object.assign(document.createElement("span"), { className: "status" });
  status.setAttribute("role", "status");
  const botoes = document.createElement("div");
  botoes.className = "botoes";
  botoes.append(botao("Salvar textos", "btn-mar", "salvar"), status);
  form.replaceChildren(campos, botoes);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const linhas = TEXTOS.map((t) => ({ chave: t.chave, valor: form.elements[t.chave].value.trim() }));
    const { error } = await sb.from("conteudo").upsert(linhas);
    avisar(status, error ? "Não salvou. Tente de novo." : "Textos salvos! Já estão no site.");
  };
}

// Fotos: reduz no navegador (máx. 1600 px, JPEG) e sobe para o bucket público
async function reduzir(arquivo) {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("conversão"))), "image/jpeg", 0.82));
}

$("enviar-fotos").addEventListener("change", async (e) => {
  const arquivos = [...e.target.files];
  const status = $("status-fotos");
  let falhas = 0;
  for (const [i, arquivo] of arquivos.entries()) {
    status.textContent = `Enviando foto ${i + 1} de ${arquivos.length}…`;
    try {
      const caminho = `galeria/${crypto.randomUUID()}.jpg`;
      const { error: erroUp } = await sb.storage.from("fotos").upload(caminho, await reduzir(arquivo), { contentType: "image/jpeg" });
      if (erroUp) throw erroUp;
      const { error } = await sb.from("fotos").insert({ caminho, ordem: 0, ativa: true });
      if (error) {
        await sb.storage.from("fotos").remove([caminho]);
        throw error;
      }
    } catch {
      falhas++;
    }
  }
  e.target.value = "";
  status.textContent = falhas ? `${falhas} foto(s) não subiram. Tente de novo.` : "Fotos enviadas! Já estão no site.";
  carregarLista("fotos");
});

// Resumo
async function carregarResumo() {
  const [turmas, conteudo, marcos, avisos, fotos, novos, ativos] = await Promise.all([
    sb.from("turmas").select("nome,unidade,dias,horario,vagas,total,ativa"),
    sb.from("conteudo").select("chave,valor"),
    sb.from("marcos").select("ano,titulo,texto"),
    sb.from("avisos").select("texto,ate,ativo").order("criado_em", { ascending: false }),
    sb.from("fotos").select("id,ativa"),
    sb.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "novo"),
    sb.from("alunos").select("id", { count: "exact", head: true }).eq("status", "ativa")
  ]);
  if ([turmas, conteudo, marcos, avisos, fotos, novos, ativos].some((r) => r.error)) {
    $("resumo-numeros").textContent = "Não foi possível carregar o resumo. Recarregue a página.";
    return;
  }
  const ativas = turmas.data.filter((t) => t.ativa);
  const livres = (u) => ativas.filter((t) => t.unidade === u).reduce((s, t) => s + t.vagas, 0);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Manaus" });
  const avisoVigente = avisos.data.find((a) => a.ativo && (!a.ate || a.ate >= hoje));
  const tiles = [
    [novos.count ?? 0, "pedidos novos para responder"],
    [ativos.count ?? 0, "alunos com matrícula ativa"],
    [livres("Cidade Nova"), "vagas livres na Cidade Nova"],
    [livres("Campos Elíseos"), "vagas livres no Campos Elíseos"],
    [ativas.filter((t) => t.vagas === 0).length, "turmas cheias"],
    [fotos.data.filter((f) => f.ativa).length, "fotos no site"]
  ];
  $("resumo-numeros").innerHTML = tiles.map(([n, r]) => `<div class="numero"><strong>${n}</strong><span>${r}</span></div>`).join("");

  const item = (t) => `<li>${esc(t.nome)} – ${esc(t.unidade)} (${esc(t.dias)} ${esc(t.horario)})</li>`;
  const cheias = ativas.filter((t) => t.vagas === 0);
  const poucas = ativas.filter((t) => t.vagas > 0 && t.vagas <= 2);
  const provisorios = [
    ...TEXTOS.filter((t) => (conteudo.data.find((c) => c.chave === t.chave)?.valor || "").includes("[")).map((t) => `Textos › ${t.r}`),
    ...marcos.data.filter((m) => `${m.ano}${m.titulo}${m.texto}`.includes("[")).map((m) => `História › ${m.titulo}`),
    ...(conteudo.data.find((c) => c.chave === "whatsapp")?.valor === "5592900000000" ? ["Textos › WhatsApp (ainda é o número de exemplo)"] : [])
  ];
  const bloco = (titulo, itens, vazio) => `<div class="admin-cartao bloco"><h2>${titulo}</h2>${itens.length ? `<ul>${itens.join("")}</ul>` : `<p class="dica">${vazio}</p>`}</div>`;
  $("resumo-listas").innerHTML =
    bloco("Turmas cheias", cheias.map(item), "Nenhuma turma cheia.") +
    bloco("Últimas vagas (2 ou menos)", poucas.map(item), "Nenhuma turma acabando as vagas.") +
    bloco("Aviso no site", avisoVigente ? [`<li>${esc(avisoVigente.texto)}${avisoVigente.ate ? ` (até ${avisoVigente.ate.split("-").reverse().join("/")})` : ""}</li>`] : [], "Nenhum aviso no ar.") +
    bloco("Falta preencher", provisorios.map((p) => `<li>${esc(p)}</li>`), "Tudo preenchido!");
}

// Secretaria: lista de alunos e ficha
let alunosCache = [];
let fichaAtual = null;
const idade = (nasc) => {
  if (!nasc) return "";
  const [a, m, d] = nasc.split("-").map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a - (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d) ? 1 : 0);
  return anos < 1 ? "menos de 1 ano" : `${anos} ano${anos > 1 ? "s" : ""}`;
};

async function carregarAlunos() {
  voltarParaAlunos();
  const erro = tela("alunos").querySelector(".erro");
  erro.textContent = "";
  const [turmas, alunos] = await Promise.all([
    sb.from("turmas").select("id,nome,unidade,dias,horario").order("ordem").order("id"),
    sb.from("alunos").select("id,nome,nascimento,status,turma_id").order("nome")
  ]);
  if (turmas.error || alunos.error) return (erro.textContent = "Não foi possível carregar. Recarregue a página.");
  turmasCache = turmas.data;
  alunosCache = alunos.data;
  listarAlunos();
}

function listarAlunos() {
  const busca = $("busca-alunos").value.trim().toLowerCase();
  const filtro = $("filtro-alunos").value;
  const vis = alunosCache.filter((a) => (!filtro || a.status === filtro) && a.nome.toLowerCase().includes(busca));
  const turma = (id) => turmasCache.find((t) => t.id === id);
  const nomeStatus = Object.fromEntries(STATUS_ALUNO);
  $("tabela-alunos").innerHTML = vis.length
    ? vis.map((a) => `<button type="button" class="linha-aluno" data-id="${a.id}">
        <span class="la-nome">${esc(a.nome)}<small>${esc(idade(a.nascimento))}</small></span>
        <span class="la-turma">${turma(a.turma_id) ? esc(rotuloTurma(turma(a.turma_id))) : "Sem turma"}</span>
        <span class="pilula ${a.status}">${nomeStatus[a.status]}</span>
      </button>`).join("")
    : `<p class="dica">${alunosCache.length ? "Nenhum aluno encontrado com esse filtro." : "Nenhum aluno cadastrado ainda. Toque em + Novo aluno."}</p>`;
}
$("busca-alunos").addEventListener("input", listarAlunos);
$("filtro-alunos").addEventListener("change", listarAlunos);
$("tabela-alunos").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-id]");
  if (!b) return;
  const { data, error } = await sb.from("alunos").select("*").eq("id", b.dataset.id).single();
  if (error) return (tela("alunos").querySelector(".erro").textContent = "Não foi possível abrir a ficha.");
  abrirFicha(data);
});
$("novo-aluno").addEventListener("click", () => abrirFicha({ status: "ativa", inicio: new Date().toLocaleDateString("sv-SE", { timeZone: "America/Manaus" }) }));
$("voltar-alunos").addEventListener("click", carregarAlunos);

function voltarParaAlunos() {
  fichaAtual = null;
  $("alunos-lista").hidden = false;
  $("aluno-ficha").hidden = true;
}

function atualizarCabecalhoFicha(d) {
  $("ficha-titulo").textContent = d.nome || "Novo aluno";
  const salvo = Boolean(fichaAtual?.id);
  const ativa = (d.status ?? fichaAtual?.status) === "ativa";
  $("ficha-docs").hidden = !salvo;
  document.querySelectorAll("[data-doc]").forEach((a) => {
    a.href = `declaracao?aluno=${fichaAtual?.id}&tipo=${a.dataset.doc}`;
    a.toggleAttribute("aria-disabled", !ativa);
  });
  $("docs-aviso").hidden = ativa;
}

function abrirFicha(aluno) {
  fichaAtual = aluno;
  $("alunos-lista").hidden = true;
  $("aluno-ficha").hidden = false;
  $("ficha-form").replaceChildren(cartao("alunos", aluno));
  atualizarCabecalhoFicha(aluno);
  $("ficha-responsaveis").hidden = !aluno.id;
  if (aluno.id) carregarResponsaveis(aluno.id);
  window.scrollTo(0, 0);
}

async function carregarResponsaveis(alunoId) {
  const { data, error } = await sb.from("responsaveis").select("*").eq("aluno_id", alunoId).order("id");
  if (error) return ($("lista-responsaveis").innerHTML = '<p class="erro">Não foi possível carregar os responsáveis.</p>');
  $("lista-responsaveis").replaceChildren(...data.map((r) => cartao("responsaveis", r)));
  if (!data.length) $("lista-responsaveis").innerHTML = '<p class="dica">Nenhum responsável cadastrado. Toque em + Adicionar responsável.</p>';
}
$("novo-responsavel").addEventListener("click", () => {
  $("lista-responsaveis").querySelector(":scope > p.dica")?.remove();
  const form = cartao("responsaveis", { aluno_id: fichaAtual.id });
  $("lista-responsaveis").prepend(form);
  form.elements.nome.focus();
});
document.querySelectorAll("[data-doc]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (a.hasAttribute("aria-disabled")) e.preventDefault();
  })
);

// Navegação entre abas
// Usuários do painel (só dono): criar conta exige a chave de serviço, então passa pela função "usuarios"
async function chamarUsuarios(corpo) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${supabaseUrl}/functions/v1/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(corpo)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Não foi possível completar. Tente de novo.");
  return j;
}

const PAPEL_NOME = { recepcao: "Recepção (pedidos e turmas)", dono: "Dono (tudo)" };
async function carregarUsuarios() {
  const erro = tela("usuarios").querySelector(".erro");
  erro.textContent = "";
  try {
    const lista = await chamarUsuarios({ acao: "listar" });
    $("lista-usuarios").innerHTML = lista.map((u) => `<div class="admin-cartao" data-id="${esc(u.id)}">
      <div class="info"><h3>${esc(u.email)}${u.eu ? " (você)" : ""}</h3>
        <p class="quando">Último acesso: ${u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR", { timeZone: "America/Manaus", dateStyle: "short", timeStyle: "short" }) : "nunca entrou"}</p></div>
      <div class="campos"><label>Papel<select data-acao="papel"${u.eu ? " disabled" : ""}>${Object.entries(PAPEL_NOME).map(([v, r]) => `<option value="${v}"${v === u.papel ? " selected" : ""}>${r}</option>`).join("")}</select></label></div>
      <div class="botoes">${u.eu ? "" : '<button type="button" class="btn btn-apagar" data-acao="remover">Remover acesso</button>'}<span class="status" role="status"></span></div>
    </div>`).join("");
  } catch (e) {
    erro.textContent = e.message;
  }
}
$("lista-usuarios").addEventListener("change", async (e) => {
  if (e.target.dataset.acao !== "papel") return;
  const c = e.target.closest("[data-id]");
  try {
    await chamarUsuarios({ acao: "papel", user_id: c.dataset.id, papel: e.target.value });
    avisar(c.querySelector(".status"), "Papel alterado!");
  } catch (err) {
    avisar(c.querySelector(".status"), err.message);
  }
});
$("lista-usuarios").addEventListener("click", async (e) => {
  if (e.target.dataset.acao !== "remover") return;
  const c = e.target.closest("[data-id]");
  if (!confirm(`Remover o acesso de ${c.querySelector("h3").textContent}? A conta será apagada.`)) return;
  try {
    await chamarUsuarios({ acao: "remover", user_id: c.dataset.id });
    c.remove();
  } catch (err) {
    avisar(c.querySelector(".status"), err.message);
  }
});
$("form-usuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  try {
    await chamarUsuarios({ acao: "criar", email: d.get("email"), senha: d.get("senha"), papel: d.get("papel") });
    e.target.reset();
    avisar($("status-usuario"), "Usuário criado! Passe o e-mail e a senha para a pessoa.");
    carregarUsuarios();
  } catch (err) {
    avisar($("status-usuario"), err.message);
  }
});

const CARREGAR = { resumo: carregarResumo, pedidos: () => carregarLista("pedidos"), turmas: () => carregarLista("turmas"), textos: carregarTextos, marcos: () => carregarLista("marcos"), avisos: () => carregarLista("avisos"), fotos: () => carregarLista("fotos"), planos: () => carregarLista("planos"), depoimentos: () => carregarLista("depoimentos"), usuarios: carregarUsuarios, alunos: carregarAlunos };
const podeAbrir = (aba) => papel === "dono" || ABAS_RECEPCAO.includes(aba);

function abrirAba(aba) {
  if (!CARREGAR[aba] || !podeAbrir(aba)) aba = "resumo";
  document.querySelectorAll("[data-tela]").forEach((s) => (s.hidden = s.dataset.tela !== aba));
  document.querySelectorAll("[data-aba]").forEach((b) => b.setAttribute("aria-current", b.dataset.aba === aba ? "page" : "false"));
  history.replaceState(null, "", `#${aba}`);
  if (!telaLarga.matches) alternarMenu(false); // no celular o menu fecha ao escolher
  CARREGAR[aba]();
}
document.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));

// Menu lateral: no computador fica aberto e os três pontinhos recolhem; no celular abre por cima da tela
const telaLarga = matchMedia("(min-width: 901px)");
function alternarMenu(abrir) {
  const classe = telaLarga.matches ? "menu-recolhido" : "menu-aberto";
  const aberto = telaLarga.matches ? !document.body.classList.contains(classe) : document.body.classList.contains(classe);
  const quer = abrir ?? !aberto;
  document.body.classList.toggle(classe, telaLarga.matches ? !quer : quer);
  $("abrir-menu").setAttribute("aria-expanded", String(quer));
  $("abrir-menu").setAttribute("aria-label", quer ? "Fechar menu" : "Abrir menu");
}
$("abrir-menu").addEventListener("click", () => alternarMenu());
$("fundo-menu").addEventListener("click", () => alternarMenu(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && document.body.classList.contains("menu-aberto") && alternarMenu(false));
telaLarga.addEventListener("change", () => {
  document.body.classList.remove("menu-aberto", "menu-recolhido");
  $("abrir-menu").setAttribute("aria-expanded", String(telaLarga.matches));
});

function mostrarLogin() {
  $("tela-login").hidden = false;
  $("abas").hidden = $("sair").hidden = $("abrir-menu").hidden = true;
  document.body.classList.remove("menu-aberto");
  document.querySelectorAll("[data-tela]").forEach((s) => (s.hidden = true));
}

async function entrar() {
  // só quem está na tabela admins pode editar; as regras do banco garantem isso mesmo se esta checagem for burlada
  const { data: p, error } = await sb.rpc("meu_papel");
  if (error || !p) {
    await sb.auth.signOut();
    $("erro-login").textContent = "Esta conta não tem acesso ao painel.";
    return mostrarLogin();
  }
  papel = p;
  document.querySelectorAll("[data-aba]").forEach((b) => (b.hidden = !podeAbrir(b.dataset.aba)));
  document.querySelectorAll(".menu .grupo").forEach((g) => (g.hidden = ![...g.querySelectorAll("[data-aba]")].some((b) => !b.hidden)));
  document.querySelector('[data-novo="turmas"]').hidden = papel !== "dono";
  $("tela-login").hidden = true;
  $("abas").hidden = $("sair").hidden = $("abrir-menu").hidden = false;
  $("abrir-menu").setAttribute("aria-expanded", String(telaLarga.matches));
  abrirAba(location.hash.slice(1));
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  $("erro-login").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: d.get("email"), password: d.get("senha") });
  if (error) {
    $("erro-login").textContent = error.status === 429 ? "Muitas tentativas. Espere alguns minutos." : "E-mail ou senha incorretos.";
    return;
  }
  e.target.reset();
  entrar();
});

$("sair").addEventListener("click", async () => {
  await sb.auth.signOut();
  mostrarLogin();
});

sb.auth.getSession().then(({ data }) => (data.session ? entrar() : mostrarLogin()));
