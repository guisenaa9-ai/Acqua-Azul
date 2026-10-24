const { supabaseUrl, supabaseKey, whatsapp } = window.ACQUA;
const lista = document.getElementById("lista-turmas");
const selectTurma = document.getElementById("select-turma");
let turmas = [];
let filtro = "Todas";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rotulo = (t) => `${t.nome} – ${t.unidade} – ${t.dias} ${t.horario}`;

function render() {
  const vis = turmas.filter((t) => filtro === "Todas" || t.unidade === filtro);
  if (!vis.length) {
    lista.innerHTML = `<p class="aviso">Nenhuma turma aberta ${filtro === "Todas" ? "no momento" : "nesta unidade"}. Fale com a gente pelo WhatsApp!</p>`;
    return;
  }
  lista.innerHTML = vis.map((t) => {
    const poucas = t.vagas > 0 && t.vagas <= 2;
    const ocupado = Math.round(100 - (t.vagas / t.total) * 100);
    const txt = t.vagas === 0 ? "Turma cheia — entre na lista de espera" : `${poucas ? "Últimas " : ""}${t.vagas} vaga${t.vagas > 1 ? "s" : ""}`;
    return `<article class="cartao">
      <div class="cartao-topo"><h3>${esc(t.nome)}</h3><span class="tag">${esc(t.unidade)}</span></div>
      <p class="cartao-info">${esc(t.idade)}<br>${esc(t.dias)} · ${esc(t.horario)}</p>
      <div class="barra" aria-hidden="true"><i style="width:${ocupado}%"></i></div>
      <span class="vagas${poucas || t.vagas === 0 ? " poucas" : ""}">${esc(txt)}</span>
      <a class="btn btn-mar" href="#agendar" data-id="${t.id}">Quero essa turma</a>
    </article>`;
  }).join("");
}

async function carregar() {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/turmas?select=id,nome,idade,unidade,dias,horario,vagas,total&ativa=eq.true&order=ordem,id`, {
      headers: { apikey: supabaseKey }
    });
    if (!r.ok) throw new Error(r.status);
    turmas = await r.json();
    selectTurma.innerHTML = turmas.map((t) => `<option value="${t.id}">${esc(rotulo(t))}</option>`).join("") + `<option value="">Ainda não sei / quero ajuda para escolher</option>`;
    render();
  } catch {
    lista.innerHTML = `<p class="aviso">Não conseguimos carregar as turmas agora. Chame a gente no WhatsApp que passamos os horários!</p>`;
    selectTurma.innerHTML = `<option value="">Quero conhecer os horários</option>`;
  }
}

document.querySelectorAll(".filtros button").forEach((b) => b.addEventListener("click", () => {
  filtro = b.dataset.unidade;
  document.querySelectorAll(".filtros button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  render();
}));

// "Quero essa turma" já escolhe a turma no formulário
lista.addEventListener("click", (e) => {
  const a = e.target.closest("[data-id]");
  if (a) selectTurma.value = a.dataset.id;
});

document.getElementById("form-agenda").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  const t = turmas.find((x) => String(x.id) === d.get("turma"));
  const msg = `Olá! Gostaria de agendar uma aula experimental.\nResponsável: ${d.get("responsavel")}\nCriança: ${d.get("crianca")}\nTurma: ${t ? rotulo(t) : "quero ajuda para escolher"}`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
});

// Golfinho arisco: foge quando tentam tocar, volta depois de um tempo
const arisco = document.getElementById("arisco");
let timer;
function fugir() {
  if (arisco.classList.contains("fugindo")) return;
  arisco.className = "arisco fugindo";
  clearTimeout(timer);
  timer = setTimeout(() => {
    arisco.className = "arisco voltando";
    timer = setTimeout(() => (arisco.className = "arisco"), 1200);
  }, 3000);
}
arisco.addEventListener("pointerenter", fugir);
arisco.addEventListener("click", fugir);

carregar();
