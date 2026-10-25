// Recebe o pedido de aula experimental do site, confere o Cloudflare Turnstile e grava em public.pedidos.
// verify_jwt desligado: quem chama é o visitante anônimo; a proteção é o Turnstile + limite por IP.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// shortcut: sem o segredo configurado usa a chave de TESTE da Cloudflare (sempre aprova); configurar TURNSTILE_SECRET em produção
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "1x0000000000000000000000000000000AA";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });

const ORIGEM_OK = /^(https:\/\/acqua-azul[a-z0-9-]*\.vercel\.app|http:\/\/localhost:\d+)$/;
const extras = (Deno.env.get("ORIGENS_EXTRAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function cors(origem: string | null) {
  const ok = origem && (ORIGEM_OK.test(origem) || extras.includes(origem));
  return {
    "Access-Control-Allow-Origin": ok ? origem! : "https://acqua-azul-wheat.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

async function hashIp(ip: string) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  const resp = (status: number, corpo: Record<string, unknown>) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });

  let d: Record<string, unknown>;
  try {
    d = await req.json();
  } catch {
    return resp(400, { erro: "Pedido inválido." });
  }

  // campo-isca: humanos não veem, robôs preenchem
  if (texto(d.site, 200)) return resp(200, { ok: true });

  const responsavel = texto(d.responsavel, 80);
  const crianca = texto(d.crianca, 80);
  let telefone = typeof d.telefone === "string" ? d.telefone.replace(/\D/g, "") : "";
  if (telefone.length === 10 || telefone.length === 11) telefone = "55" + telefone;
  if (responsavel.length < 2 || !crianca) return resp(400, { erro: "Preencha o nome do responsável e da criança." });
  if (!/^[0-9]{12,13}$/.test(telefone)) return resp(400, { erro: "Confira o telefone com DDD." });
  if (d.consentimento !== true) return resp(400, { erro: "É preciso autorizar o contato para enviar." });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const verif = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: texto(d.token, 4096), remoteip: ip }),
  }).then((r) => r.json()).catch(() => ({ success: false }));
  if (!verif.success) return resp(403, { erro: "Não conseguimos confirmar que você não é um robô. Tente de novo." });

  const ipHash = ip ? await hashIp(ip) : "";
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const [doIp, geral] = await Promise.all([
    ipHash ? db.from("pedidos").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("criado_em", umaHora) : { count: 0 },
    db.from("pedidos").select("id", { count: "exact", head: true }).gte("criado_em", umaHora),
  ]);
  if ((doIp.count ?? 0) >= 3 || (geral.count ?? 0) >= 60) return resp(429, { erro: "Muitos pedidos agora. Fale com a gente pelo WhatsApp." });

  let turmaId: number | null = null;
  let turmaTexto = "Quer ajuda para escolher";
  if (d.turma_id) {
    const { data: t } = await db.from("turmas").select("id,nome,unidade,dias,horario").eq("id", Number(d.turma_id)).eq("ativa", true).maybeSingle();
    if (t) {
      turmaId = t.id;
      turmaTexto = `${t.nome} – ${t.unidade} – ${t.dias} ${t.horario}`;
    }
  }

  const { error } = await db.from("pedidos").insert({
    responsavel, telefone, crianca, turma_id: turmaId, turma_texto: turmaTexto,
    consentimento_em: new Date().toISOString(), ip_hash: ipHash,
  });
  if (error) return resp(500, { erro: "Não conseguimos salvar agora. Fale com a gente pelo WhatsApp." });
  return resp(201, { ok: true });
});
