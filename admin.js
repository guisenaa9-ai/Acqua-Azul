const { supabaseUrl, supabaseKey } = window.ACQUA;
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
const $ = (id) => document.getElementById(id);
const CAMPOS = ["nome", "unidade", "idade", "dias", "horario", "vagas", "total", "ordem"];

function mostrar(tela) {
  $("tela-login").hidden = tela !== "login";
  $("tela-turmas").hidden = tela !== "turmas";
  $("sair").hidden = tela !== "turmas";
}

async function entrar() {
  // só quem está na tabela admins pode editar; as regras do banco garantem isso mesmo se esta checagem for burlada
  const { data: ehAdmin, error } = await sb.rpc("is_admin");
  if (error || !ehAdmin) {
    await sb.auth.signOut();
    $("erro-login").textContent = "Esta conta não tem acesso ao painel.";
    return mostrar("login");
  }
  mostrar("turmas");
  carregar();
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
  mostrar("login");
});

async function carregar() {
  $("erro-turmas").textContent = "";
  const { data, error } = await sb.from("turmas").select("*").order("ordem").order("id");
  if (error) return ($("erro-turmas").textContent = "Não foi possível carregar as turmas. Recarregue a página.");
  $("lista").replaceChildren(...data.map(cartao));
}

function lerForm(form) {
  const d = new FormData(form);
  const t = Object.fromEntries(CAMPOS.map((c) => [c, String(d.get(c) ?? "").trim()]));
  t.vagas = Number(t.vagas);
  t.total = Number(t.total);
  t.ordem = Number(t.ordem) || 0;
  t.ativa = form.elements.ativa.checked;
  return t;
}

function cartao(t) {
  const form = $("tpl-turma").content.firstElementChild.cloneNode(true);
  const status = form.querySelector(".status");
  const nova = !t.id;
  CAMPOS.forEach((c) => (form.elements[c].value = t[c] ?? ""));
  form.elements.ativa.checked = t.ativa ?? true;
  form.classList.toggle("nova", nova);

  const pintar = () => {
    const v = Number(form.elements.vagas.value), tot = Number(form.elements.total.value);
    form.querySelector('[data-campo="vagasTxt"]').textContent = `${v} de ${tot}`;
    form.querySelector('[data-acao="menos"]').disabled = nova || v <= 0;
    form.querySelector('[data-acao="mais"]').disabled = nova || v >= tot;
    form.classList.toggle("inativa", !form.elements.ativa.checked);
  };
  pintar();
  form.addEventListener("input", pintar);

  const avisar = (msg) => {
    status.textContent = msg;
    clearTimeout(form._t);
    form._t = setTimeout(() => (status.textContent = ""), 3000);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = lerForm(form);
    if (dados.vagas > dados.total) return avisar("Vagas livres não podem passar do total.");
    const q = nova ? sb.from("turmas").insert(dados) : sb.from("turmas").update(dados).eq("id", t.id);
    const { error } = await q;
    if (error) return avisar("Não salvou. Confira os campos e tente de novo.");
    avisar("Salvo!");
    if (nova) carregar();
  });

  form.addEventListener("click", async (e) => {
    const acao = e.target.dataset.acao;
    if (acao === "menos" || acao === "mais") {
      const v = Number(form.elements.vagas.value) + (acao === "mais" ? 1 : -1);
      const { error } = await sb.from("turmas").update({ vagas: v }).eq("id", t.id);
      if (error) return avisar("Não salvou. Tente de novo.");
      form.elements.vagas.value = v;
      pintar();
      avisar("Vagas atualizadas!");
    }
    if (acao === "apagar") {
      if (nova) return form.remove();
      if (!confirm(`Apagar a turma "${t.nome}" de vez? Se for só esconder do site, desmarque "Aparece no site".`)) return;
      const { error } = await sb.from("turmas").delete().eq("id", t.id);
      if (error) return avisar("Não apagou. Tente de novo.");
      form.remove();
    }
  });
  return form;
}

$("nova").addEventListener("click", () => {
  const form = cartao({ unidade: "Cidade Nova", vagas: 8, total: 8, ordem: 0, ativa: true });
  $("lista").prepend(form);
  form.elements.nome.focus();
});

sb.auth.getSession().then(({ data }) => (data.session ? entrar() : mostrar("login")));
