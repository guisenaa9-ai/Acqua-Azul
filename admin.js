const { supabaseUrl, supabaseKey } = window.ACQUA;
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
const $ = (id) => document.getElementById(id);
const tela = (nome) => document.querySelector(`[data-tela="${nome}"]`);
const urlFoto = (caminho) => `${supabaseUrl}/storage/v1/object/public/fotos/${caminho}`;

// Campos de cada tabela editável. t: tipo do campo; r: rótulo.
const TABELAS = {
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
  { chave: "end_cidade_nova", r: "Endereço da unidade Cidade Nova", t: "textarea", max: 200 },
  { chave: "end_campos_eliseos", r: "Endereço da unidade Campos Elíseos", t: "textarea", max: 200 }
];

function criarCampo(def, valor) {
  const label = document.createElement("label");
  if (def.largo || def.t === "textarea") label.className = "largo";
  let input;
  if (def.t === "select") {
    input = document.createElement("select");
    def.op.forEach((o) => input.add(new Option(o)));
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
    input.value = valor ?? "";
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
    const { error } = nova ? await sb.from(tabela).insert(dados) : await sb.from(tabela).update(dados).eq("id", item.id);
    if (error) return avisar(status, "Não salvou. Confira os campos e tente de novo.");
    avisar(status, "Salvo!");
    if (nova) carregarLista(tabela);
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
  if (!data.length) sec.querySelector("[data-lista]").innerHTML = '<p class="dica">Nada cadastrado ainda.</p>';
}

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
  const [turmas, conteudo, marcos, avisos, fotos] = await Promise.all([
    sb.from("turmas").select("nome,unidade,dias,horario,vagas,total,ativa"),
    sb.from("conteudo").select("chave,valor"),
    sb.from("marcos").select("ano,titulo,texto"),
    sb.from("avisos").select("texto,ate,ativo").order("criado_em", { ascending: false }),
    sb.from("fotos").select("id,ativa")
  ]);
  if ([turmas, conteudo, marcos, avisos, fotos].some((r) => r.error)) {
    $("resumo-numeros").textContent = "Não foi possível carregar o resumo. Recarregue a página.";
    return;
  }
  const ativas = turmas.data.filter((t) => t.ativa);
  const livres = (u) => ativas.filter((t) => t.unidade === u).reduce((s, t) => s + t.vagas, 0);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Manaus" });
  const avisoVigente = avisos.data.find((a) => a.ativo && (!a.ate || a.ate >= hoje));
  const tiles = [
    [livres("Cidade Nova"), "vagas livres na Cidade Nova"],
    [livres("Campos Elíseos"), "vagas livres no Campos Elíseos"],
    [ativas.filter((t) => t.vagas === 0).length, "turmas cheias"],
    [fotos.data.filter((f) => f.ativa).length, "fotos no site"]
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

// Navegação entre abas
const CARREGAR = { resumo: carregarResumo, turmas: () => carregarLista("turmas"), textos: carregarTextos, marcos: () => carregarLista("marcos"), avisos: () => carregarLista("avisos"), fotos: () => carregarLista("fotos") };

function abrirAba(aba) {
  if (!CARREGAR[aba]) aba = "resumo";
  document.querySelectorAll("[data-tela]").forEach((s) => (s.hidden = s.dataset.tela !== aba));
  document.querySelectorAll("[data-aba]").forEach((b) => b.setAttribute("aria-current", b.dataset.aba === aba ? "page" : "false"));
  history.replaceState(null, "", `#${aba}`);
  CARREGAR[aba]();
}
document.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));

function mostrarLogin() {
  $("tela-login").hidden = false;
  $("abas").hidden = $("sair").hidden = true;
  document.querySelectorAll("[data-tela]").forEach((s) => (s.hidden = true));
}

async function entrar() {
  // só quem está na tabela admins pode editar; as regras do banco garantem isso mesmo se esta checagem for burlada
  const { data: ehAdmin, error } = await sb.rpc("is_admin");
  if (error || !ehAdmin) {
    await sb.auth.signOut();
    $("erro-login").textContent = "Esta conta não tem acesso ao painel.";
    return mostrarLogin();
  }
  $("tela-login").hidden = true;
  $("abas").hidden = $("sair").hidden = false;
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
