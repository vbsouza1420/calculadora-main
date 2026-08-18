import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  return new Response(JSON.stringify(deleteError ? { error: deleteError.message } : { ok: true }), { status: deleteError ? 500 : 200, headers: { ...headers, "Content-Type": "application/json" } });
});
