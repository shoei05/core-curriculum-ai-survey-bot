import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  RESPONDENT_TYPE_LABELS,
  UNIVERSITY_TYPE_LABELS,
  SPECIALTY_LABELS,
  EXPERIENCE_YEARS_LABELS,
  STUDENT_YEAR_LABELS,
  CHALLENGE_LABELS,
  EXPECTATION_LABELS,
} from "@/types/survey";

// 管理者パスワード検証
function verifyPassword(password: string): boolean {
  return password === (process.env.ADMIN_PASSWORD || "admin123");
}

// コードを日本語ラベルに変換
function codeToLabel<T extends Record<string, string>>(
  labels: T,
  code: string | string[] | null
): string {
  if (code === null || code === undefined) return "";
  if (Array.isArray(code)) {
    return code.map((c) => labels[c] || c).join("、");
  }
  return labels[code] || code;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // リクエストボディからパスワードを取得
  const body = await req.json();
  const { password } = body;

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    // form_responsesを取得
    const { data: formResponses, error: formError } = await (supabase as any)
      .from("form_responses")
      .select("*")
      .order("created_at", { ascending: false });

    if (formError) {
      console.error("Form responses fetch error:", formError);
      return NextResponse.json(
        { error: "フォームデータの取得に失敗しました" },
        { status: 500 }
      );
    }

    // CSVヘッダー（BOM付きUTF-8）
    let csv = "\uFEFF"; // BOM

    csv += "回答日時,回答者タイプ,大学設置形態,専門分野,教育経験,学年,課題認識,その他の課題,期待,その他の期待,チャットログ有無\n";

    // データ行
    for (const item of formResponses || []) {
      const row = [
        // 回答日時
        `"${new Date(item.created_at).toLocaleString("ja-JP")}"`,
        // 回答者タイプ
        codeToLabel(RESPONDENT_TYPE_LABELS, item.respondent_type),
        // 大学設置形態
        codeToLabel(UNIVERSITY_TYPE_LABELS, item.university_type),
        // 専門分野（教員のみ）
        item.respondent_type === "faculty"
          ? codeToLabel(SPECIALTY_LABELS, item.specialty)
          : "",
        // 教育経験（教員のみ）
        item.respondent_type === "faculty"
          ? codeToLabel(EXPERIENCE_YEARS_LABELS, item.experience_years)
          : "",
        // 学年（学生のみ）
        item.respondent_type === "student"
          ? codeToLabel(STUDENT_YEAR_LABELS, item.student_year)
          : "",
        // 課題認識（日本語ラベル）
        `"${codeToLabel(CHALLENGE_LABELS, item.challenges)}"`,
        // その他の課題
        `"${(item.challenge_other || "").replace(/"/g, '""')}"`,
        // 期待（日本語ラベル）
        `"${codeToLabel(EXPECTATION_LABELS, item.expectations)}"`,
        // その他の期待
        `"${(item.expectation_other || "").replace(/"/g, '""')}"`,
        // チャットログ有無（ survey_logsテーブルを確認）
      ];

      // チャットログの有無を確認
      const { data: logData } = await (supabase as any)
        .from("survey_logs")
        .select("id")
        .eq("form_response_id", item.id)
        .single();

      row.push(logData ? "あり" : "なし");

      csv += row.join(",") + "\n";
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="form_responses_${new Date()
          .toISOString()
          .split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV Export error:", error);
    return NextResponse.json(
      { error: "CSV出力に失敗しました" },
      { status: 500 }
    );
  }
}
