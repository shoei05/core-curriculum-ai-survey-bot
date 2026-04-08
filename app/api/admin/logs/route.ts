import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs, error } = await (supabase as any)
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const normalized = (logs ?? []).map((log: Record<string, unknown>) => ({
      id: log.id,
      template_slug: log.template_slug ?? "two-stage-survey",
      created_at: log.created_at,
      messages: Array.isArray(log.messages) ? log.messages : [],
      form_response_id: log.form_response_id ?? null,
      respondent_type: log.respondent_type ?? null,
      analysis_version: log.analysis_version ?? null,
      summary_view: {
        summary_bullets:
          (Array.isArray(log.conversation_summary_bullets) ? log.conversation_summary_bullets : null) ??
          (Array.isArray(log.summary_bullets) ? log.summary_bullets : []),
        topic_groups:
          (Array.isArray(log.conversation_topic_groups) ? log.conversation_topic_groups : null) ??
          (Array.isArray(log.keyword_groups) ? log.keyword_groups : []),
      },
      coding_primary: {
        in_vivo_codes: Array.isArray(log.participant_in_vivo_codes) ? log.participant_in_vivo_codes : [],
        issue_categories:
          (Array.isArray(log.participant_issue_categories) ? log.participant_issue_categories : null) ??
          (Array.isArray(log.issue_categories) ? log.issue_categories : []),
        competency_categories:
          (Array.isArray(log.participant_competency_categories) ? log.participant_competency_categories : null) ??
          (Array.isArray(log.competency_categories) ? log.competency_categories : []),
        core_items:
          (Array.isArray(log.participant_core_items) ? log.participant_core_items : null) ??
          (Array.isArray(log.core_items) ? log.core_items : []),
      },
      coding_sensitivity: {
        topic_groups: Array.isArray(log.coding_sensitivity_topic_groups) ? log.coding_sensitivity_topic_groups : [],
      },
      participant_messages: Array.isArray(log.participant_messages) ? log.participant_messages : [],
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Logs API error:", error);
    return NextResponse.json({ error: "ログデータの取得に失敗しました" }, { status: 500 });
  }
}
