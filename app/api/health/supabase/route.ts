import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response(JSON.stringify({ ok: false, reason: "Supabase env missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";
  const { error } = await supabase
    .from(tableName)
    .select("id")
    .limit(1);

  if (error) {
    return new Response(JSON.stringify({
      ok: false,
      reason: "Supabase query failed",
      detail: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify({ ok: true, table: tableName }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
