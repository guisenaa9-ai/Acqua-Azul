const { supabaseUrl, supabaseKey } = window.ACQUA;
let whatsapp = window.ACQUA.whatsapp;
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

async function api(consulta) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${consulta}`, { headers: { apikey: supabaseKey } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// Textos, história, aviso e fotos editados no painel. Se falhar, ficam os textos que já estão no HTML.
async function carregarConteudo() {
  document.querySelectorAll("[data-mapa]").forEach((a) => (a.hidden = true));
  const [conteudo, marcos, avisos, fotos] = await Promise.all([
    api("conteudo?select=chave,valor"),
    api("marcos?select=ano,titulo,texto&order=ordem,id"),
    api("avisos?select=texto&order=criado_em.desc&limit=1"), // as regras do banco só devolvem avisos vigentes
    api("fotos?select=caminho,legenda&order=ordem,id")
  ]);
  const c = Object.fromEntries(conteudo.map((x) => [x.chave, x.valor]));
  document.querySelectorAll("[data-conteudo]").forEach((el) => {
    if (c[el.dataset.conteudo]) el.textContent = c[el.dataset.conteudo];
  });
  if (/^\d{12,13}$/.test(c.whatsapp || "")) whatsapp = c.whatsapp;
  document.querySelectorAll("[data-mapa]").forEach((a) => {
    const end = c[a.dataset.mapa];
    if (!end || end.startsWith("[")) return;
    a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end + ", Manaus - AM")}`;
    a.hidden = false;
  });
  document.getElementById("linha-historia").innerHTML = marcos
    .map((m) => `<div class="marco"><b>${esc(m.ano)}</b><h3>${esc(m.titulo)}</h3><p>${esc(m.texto)}</p></div>`)
    .join("");
  const aviso = document.getElementById("aviso-topo");
  if (avisos[0]) {
    aviso.textContent = avisos[0].texto;
    aviso.hidden = false;
  }
  if (fotos.length) {
    document.getElementById("lista-fotos").innerHTML = fotos
      .map((f) => `<figure><img src="${supabaseUrl}/storage/v1/object/public/fotos/${esc(f.caminho)}" alt="${esc(f.legenda || "Foto da Acqua Azul")}" loading="lazy">${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ""}</figure>`)
      .join("");
    document.getElementById("galeria").hidden = false;
  }
}

async function carregar() {
  try {
    turmas = await api("turmas?select=id,nome,idade,unidade,dias,horario,vagas,total&ativa=eq.true&order=ordem,id");
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

// Golfinhos ariscos: fogem para o lado oposto ao toque e voltam depois de um tempo
document.querySelectorAll(".arisco").forEach((arisco) => {
  let timer;
  const fugir = (e) => {
    if (arisco.classList.contains("fugindo")) return;
    const r = arisco.querySelector("svg").getBoundingClientRect(); // o desenho, que se move dentro do botão
    // toque à esquerda do golfinho → foge para a direita; à direita → para a esquerda (teclado: direita)
    const dir = e.clientX && e.clientX > r.left + r.width / 2 ? -1 : 1;
    arisco.style.setProperty("--dir", dir);
    arisco.classList.remove("voltando");
    arisco.classList.add("fugindo");
    clearTimeout(timer);
    timer = setTimeout(() => {
      arisco.classList.replace("fugindo", "voltando");
      timer = setTimeout(() => arisco.classList.remove("voltando"), 1200);
    }, 3000);
  };
  arisco.addEventListener("pointerenter", fugir);
  arisco.addEventListener("click", fugir);
});

// Patinhos de borracha boiando na onda do meio (onda-2: y = 70 − 20·sen(2πu/960), em unidades do viewBox 2880×120;
// anda ao contrário em 9 s). A da frente fica escondida atrás dos cartões de números.
document.querySelectorAll(".ondas").forEach((ondas) => {
  const onda = ondas.querySelector(".onda.o2");
  const patos = [...ondas.querySelectorAll(".pato")].map((el) => ({ el, x: null, vel: Number(el.dataset.vel) }));
  if (!onda || !patos.length) return;
  const anim = onda.getAnimations()[0];
  let antes = performance.now();
  const passo = (agora) => {
    const dt = Math.min(agora - antes, 100) / 1000;
    antes = agora;
    const larg = ondas.clientWidth, largOnda = onda.getBoundingClientRect().width;
    const desloc = anim && anim.currentTime != null ? -(1 - (anim.currentTime % 9000) / 9000) * (largOnda / 2) : 0;
    const k = 2880 / largOnda; // unidades da onda por px
    for (const p of patos) {
      const w = p.el.clientWidth, h = p.el.clientHeight;
      if (p.x === null) p.x = (Number(p.el.dataset.x) / 100) * larg;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) p.x += p.vel * dt;
      if (p.x > larg + w) p.x = -w;
      const u = (p.x + w / 2 - desloc) * k;
      const ang = (2 * Math.PI * u) / 960;
      const y = 70 - 20 * Math.sin(ang);
      const incl = Math.atan(-20 * Math.cos(ang) * ((2 * Math.PI) / 960) * k);
      p.el.style.transform = `translate(${p.x}px, ${y - h * 0.8}px) rotate(${incl}rad)`;
    }
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
});

carregar();
carregarConteudo().catch(() => {});
