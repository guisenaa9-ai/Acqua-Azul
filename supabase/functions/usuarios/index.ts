// Gerencia quem acessa o painel. Só quem tem papel 'dono' pode chamar.
// Precisa da chave de serviço para criar/apagar contas no Auth, por isso roda no servidor.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGEM_OK = /^(https:\/\/acqua-azul[a-z0-9-]*\.vercel\.app|http:\/\/localhost:\d+)$/;
const extras = (Deno.env.get("ORIGENS_EXTRAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const PAPEIS = ["dono", "recepcao"];

function cors(origem: string | null) {
  const ok = origem && (ORIGEM_OK.test(origem) || extras.includes(origem));
  return {
    "Access-Control-Allow-Origin": ok ? origem! : "https://acqua-azul-wheat.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  const resp = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return resp(405, { erro: "Método não permitido." });

  // quem está chamando precisa ser dono
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await db.auth.getUser(token);
  if (!quem?.user) return resp(401, { erro: "Entre de novo no painel." });
  const { data: eu } = await db.from("admins").select("papel").eq("user_id", quem.user.id).maybeSingle();
  if (eu?.papel !== "dono") return resp(403, { erro: "Só o dono pode gerenciar usuários." });

  let d: Record<string, unknown>;
  try {
    d = await req.json();
  } catch {
    return resp(400, { erro: "Pedido inválido." });
  }

  if (d.acao === "listar") {
    const { data: admins, error } = await db.from("admins").select("user_id,papel");
    if (error) return resp(500, { erro: "Não foi possível listar." });
    const lista = [];
    for (const a of admins) {
      const { data } = await db.auth.admin.getUserById(a.user_id);
      lista.push({ id: a.user_id, email: data.user?.email ?? "?", papel: a.papel, ultimo_acesso: data.user?.last_sign_in_at ?? null, eu: a.user_id === quem.user.id });
    }
    return resp(200, lista);
  }

  if (d.acao === "criar") {
    const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
    const senha = typeof d.senha === "string" ? d.senha : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resp(400, { erro: "E-mail inválido." });
    if (senha.length < 8) return resp(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
    if (!PAPEIS.includes(d.papel as string)) return resp(400, { erro: "Papel inválido." });
    const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error) return resp(400, { erro: /registered|exists/i.test(error.message) ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta. Tente uma senha mais forte." });
    const { error: e2 } = await db.from("admins").insert({ user_id: data.user.id, papel: d.papel });
    if (e2) {
      await db.auth.admin.deleteUser(data.user.id);
      return resp(500, { erro: "Não foi possível dar acesso. Tente de novo." });
    }
    return resp(201, { ok: true });
  }

  if (d.acao === "papel" || d.acao === "remover") {
    const alvo = typeof d.user_id === "string" ? d.user_id : "";
    if (alvo === quem.user.id) return resp(400, { erro: "Você não pode mudar nem remover o seu próprio acesso." });
    const { data: a } = await db.from("admins").select("papel").eq("user_id", alvo).maybeSingle();
    if (!a) return resp(404, { erro: "Usuário não encontrado." });
    if (d.acao === "papel") {
      if (!PAPEIS.includes(d.papel as string)) return resp(400, { erro: "Papel inválido." });
      const { error } = await db.from("admins").update({ papel: d.papel }).eq("user_id", alvo);
      return error ? resp(500, { erro: "Não foi possível mudar o papel." }) : resp(200, { ok: true });
    }
    const { error } = await db.auth.admin.deleteUser(alvo); // apaga a conta; o acesso some junto (on delete cascade)
    return error ? resp(500, { erro: "Não foi possível remover." }) : resp(200, { ok: true });
  }

  return resp(400, { erro: "Ação desconhecida." });
});
