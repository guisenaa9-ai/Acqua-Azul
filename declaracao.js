const { supabaseUrl, supabaseKey } = window.ACQUA;
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const cpfBonito = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c);

const TIPOS = {
  matricula: {
    titulo: "DECLARAÇÃO DE MATRÍCULA",
    texto: (d) => `Declaramos, para os devidos fins, que <b>${d.aluno}</b>${d.nasc}, está regularmente matriculado(a) na ${d.escola}${d.turma}, desde ${d.inicio}.`
  },
  frequencia: {
    titulo: "DECLARAÇÃO DE FREQUÊNCIA",
    texto: (d) => `Declaramos, para os devidos fins, que <b>${d.aluno}</b>${d.nasc}, frequenta as aulas de natação da ${d.escola}${d.turma}, desde ${d.inicio}.`
  }
};

function mostrarDica(msg) {
  $("dica-doc").textContent = msg;
}

async function montar() {
  const params = new URLSearchParams(location.search);
  const tipo = TIPOS[params.get("tipo")];
  const id = Number(params.get("aluno"));
  if (!tipo || !id) return mostrarDica("Endereço da declaração inválido. Volte ao painel e use os botões da ficha do aluno.");

  const { data: sessao } = await sb.auth.getSession();
  if (!sessao.session) return mostrarDica("Entre no painel primeiro (acqua-azul-wheat.vercel.app/admin) e abra a declaração de novo.");

  const [aluno, conteudo] = await Promise.all([
    sb.from("alunos").select("*, turmas(nome,unidade,dias,horario), responsaveis(nome,cpf,parentesco,financeiro)").eq("id", id).maybeSingle(),
    sb.from("conteudo").select("chave,valor").like("chave", "escola_%")
  ]);
  if (aluno.error || conteudo.error) return mostrarDica("Não foi possível carregar os dados. Recarregue a página.");
  if (!aluno.data) return mostrarDica("Aluno não encontrado, ou sua conta não tem acesso.");
  const a = aluno.data;
  if (a.status !== "ativa") return mostrarDica("Esta matrícula não está ativa, então a declaração não pode ser emitida.");

  const e = Object.fromEntries(conteudo.data.map((x) => [x.chave, x.valor]));
  const faltando = ["escola_razao", "escola_cnpj", "escola_endereco", "escola_responsavel"].filter((k) => !e[k] || e[k].startsWith("["));
  if (faltando.length) {
    $("aviso-doc").textContent = "Os dados da escola ainda estão com [marcadores]. Preencha em Textos › Documentos no painel antes de entregar a declaração.";
    $("aviso-doc").hidden = false;
  }

  const resp = a.responsaveis.find((r) => r.financeiro) || a.responsaveis[0];
  const t = a.turmas;
  const d = {
    aluno: esc(a.nome),
    nasc: a.nascimento ? `, nascido(a) em ${dataBr(a.nascimento)}` : "",
    escola: `${esc(e.escola_razao)} (Acqua Azul Natação), inscrita no CNPJ ${esc(e.escola_cnpj)}`,
    turma: t ? `, na turma ${esc(t.nome)}, com aulas às ${esc(t.dias)}, ${esc(t.horario)}, na unidade ${esc(t.unidade)}` : "",
    inicio: dataBr(a.inicio)
  };
  let corpo = `<p>${tipo.texto(d)}</p>`;
  if (resp) corpo += `<p>Responsável: ${esc(resp.nome)}${resp.parentesco ? ` (${esc(resp.parentesco)})` : ""}${resp.cpf ? `, CPF ${esc(cpfBonito(resp.cpf))}` : ""}.</p>`;
  corpo += "<p>Por ser verdade, firmamos a presente declaração.</p>";

  document.title = `${tipo.titulo} · ${a.nome}`;
  $("titulo-doc").textContent = tipo.titulo;
  $("dados-escola").textContent = [e.escola_razao, e.escola_cnpj && `CNPJ ${e.escola_cnpj}`, e.escola_endereco].filter(Boolean).join(" · ");
  $("corpo").innerHTML = corpo;
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Manaus", day: "numeric", month: "long", year: "numeric" });
  $("local-data").textContent = `Manaus, ${hoje}.`;
  $("quem-assina").textContent = `${e.escola_responsavel || ""}\n${e.escola_razao || ""}`;
  $("folha").hidden = false;
  $("imprimir").hidden = false;
  mostrarDica("Você pode ajustar o texto clicando nele antes de imprimir.");
}

$("imprimir").addEventListener("click", () => window.print());
montar();
