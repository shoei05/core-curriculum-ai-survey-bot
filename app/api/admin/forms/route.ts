import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getChallengeLabels,
  getExpectationLabels,
  getExperienceLabel,
  getRoleLabel,
  getSpecialtyLabel,
  getStudentYearLabel,
  getUniversityLabel,
  normalizeRoleArray,
} from "@/lib/survey-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formResponses, error: formError } = await (supabase as any)
      .from("form_responses")
      .select("*")
      .order("created_at", { ascending: false });

    if (formError) {
      console.error("Form responses fetch error:", formError);
      return NextResponse.json({ error: "フォームデータの取得に失敗しました" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkedLogs } = await (supabase as any)
      .from("survey_logs")
      .select("form_response_id, conversation_summary_bullets, summary_bullets");

    const logMap = new Map(
      (linkedLogs ?? []).map((log: { form_response_id: string | null; conversation_summary_bullets?: string[]; summary_bullets?: string[] }) => [
        log.form_response_id,
        log.conversation_summary_bullets ?? log.summary_bullets ?? [],
      ]),
    );

    const responses = (formResponses ?? []).map((item: Record<string, unknown>) => {
      const additionalRoles = normalizeRoleArray(item.additional_roles).map((role) => getRoleLabel(role));
      const respondentTypeCode = typeof item.respondent_type === "string" ? item.respondent_type : "";
      const summary = (typeof item.id === "string" ? logMap.get(item.id) ?? [] : []) as string[];

      return {
        id: item.id,
        session_id: item.session_id,
        created_at: item.created_at,
        respondent_type: getRoleLabel(respondentTypeCode),
        respondent_type_code: respondentTypeCode,
        additional_roles: additionalRoles,
        university_type: getUniversityLabel(typeof item.university_type === "string" ? item.university_type : null),
        specialty: getSpecialtyLabel(typeof item.specialty === "string" ? item.specialty : null),
        experience_years: getExperienceLabel(typeof item.experience_years === "string" ? item.experience_years : null),
        student_year: getStudentYearLabel(typeof item.student_year === "string" ? item.student_year : null),
        practitioner_profession:
          typeof item.practitioner_profession === "string" ? item.practitioner_profession : null,
        staff_role: typeof item.staff_role === "string" ? item.staff_role : null,
        challenges: getChallengeLabels(item.challenges, typeof item.challenge_other === "string" ? item.challenge_other : null),
        challenges_code: Array.isArray(item.challenges) ? item.challenges : [],
        challenge_other: typeof item.challenge_other === "string" ? item.challenge_other : null,
        expectations: getExpectationLabels(
          item.expectations,
          typeof item.expectation_other === "string" ? item.expectation_other : null,
        ),
        expectations_code: Array.isArray(item.expectations) ? item.expectations : [],
        expectation_other: typeof item.expectation_other === "string" ? item.expectation_other : null,
        consent_given: Boolean(item.consent_given),
        consent_version: typeof item.consent_version === "string" ? item.consent_version : null,
        consented_at: typeof item.consented_at === "string" ? item.consented_at : null,
        has_chat_log: summary.length > 0,
        chat_summary: summary,
      };
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error("Forms API error:", error);
    return NextResponse.json({ error: "データの取得に失敗しました" }, { status: 500 });
  }
}
