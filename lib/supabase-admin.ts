import { createClient } from "@supabase/supabase-js";

type SupabaseAdminClient = ReturnType<typeof createClient>;

/**
 * 管理用Supabaseクライアントを取得
 * service_roleキーのみを使用し、匿名キーへのフォールバックは行わない
 *
 * @throws {Error} SUPABASE_URLまたはSUPABASE_SERVICE_ROLE_KEYが未設定の場合
 */
export const getSupabaseAdmin = (): SupabaseAdminClient => {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env["survey-data-SUPABASE_URL"];
  // 管理権限が必要なためservice_roleキーのみ必須
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }

  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured (required for admin operations)");
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
