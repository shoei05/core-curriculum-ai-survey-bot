import { createClient } from "@supabase/supabase-js";

type SupabaseAdminClient = ReturnType<typeof createClient>;

export const getSupabaseAdmin = (): SupabaseAdminClient | null => {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env["survey-data-SUPABASE_URL"];
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env["survey-data-SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        "X-Client-Info": "core-curriculum-ai-survey-bot"
      }
    }
  });
};
