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

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formResponses, error } = await (supabase as any)
      .from("form_responses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Form responses export error:", error);
      return NextResponse.json({ error: "フォームデータの取得に失敗しました" }, { status: 500 });
    }

    let csv = "\uFEFF";
    csv += [
      "回答日時",
      "主たる立場",
      "追加ロール",
      "所属機関種別",
      "専門分野",
      "経験年数",
      "学年",
      "医療者の職種",
      "職員の担当",
      "課題認識",
      "その他の課題",
      "期待",
      "その他の期待",
      "同意取得",
      "同意バージョン",
      "同意日時",
    ].join(",");
    csv += "\n";

    for (const item of formResponses ?? []) {
      csv += [
        escapeCsv(new Date(item.created_at).toLocaleString("ja-JP")),
        escapeCsv(getRoleLabel(item.respondent_type)),
        escapeCsv(normalizeRoleArray(item.additional_roles).map((role) => getRoleLabel(role)).join(" / ")),
        escapeCsv(getUniversityLabel(item.university_type)),
        escapeCsv(getSpecialtyLabel(item.specialty)),
        escapeCsv(getExperienceLabel(item.experience_years)),
        escapeCsv(getStudentYearLabel(item.student_year)),
        escapeCsv(item.practitioner_profession ?? ""),
        escapeCsv(item.staff_role ?? ""),
        escapeCsv(getChallengeLabels(item.challenges, item.challenge_other).join(" / ")),
        escapeCsv(item.challenge_other ?? ""),
        escapeCsv(getExpectationLabels(item.expectations, item.expectation_other).join(" / ")),
        escapeCsv(item.expectation_other ?? ""),
        escapeCsv(item.consent_given ? "true" : "false"),
        escapeCsv(item.consent_version ?? ""),
        escapeCsv(item.consented_at ?? ""),
      ].join(",");
      csv += "\n";
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="form_responses_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV Export error:", error);
    return NextResponse.json({ error: "CSV出力に失敗しました" }, { status: 500 });
  }
}
