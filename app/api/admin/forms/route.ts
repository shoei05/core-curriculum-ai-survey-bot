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

// コードを日本語ラベルに変換（配列用）
function codeToLabel<T extends Record<string, string>>(
  labels: T,
  code: string | string[] | null
): string | string[] | null {
  if (code === null || code === undefined) return null;
  if (Array.isArray(code)) {
    return code.map((c) => labels[c] || c);
  }
  return labels[code] || code;
}

// コードを日本語ラベルに変換（単一用）
function codeToLabelSingle<T extends Record<string, string>>(
  labels: T,
  code: string | null
): string | null {
  if (code === null || code === undefined) return null;
  return labels[code] || code;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // URLパラメータからパスワードを取得
  const url = new URL(req.url);
  const password = url.searchParams.get("password");

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

    // survey_logsからチャットログの有無を確認
    const { data: surveyLogs, error: logsError } = await (supabase as any)
      .from("survey_logs")
      .select("form_response_id, summary_bullets");

    if (logsError) {
      console.error("Survey logs fetch error:", logsError);
      // ログ取得エラーは致命的ではないので続行
    }

    // チャットログの有無をマッピング
    const logMap = new Map(
      (surveyLogs || []).map((log: any) => [log.form_response_id, log.summary_bullets])
    );

    // レスポンスを変換
    const responses = (formResponses || []).map((item: any) => {
      // 専門分野/学年を統合した属性表示
      let attribute: string | null = null;
      if (item.respondent_type === "faculty" && item.specialty) {
        attribute = codeToLabelSingle(SPECIALTY_LABELS, item.specialty);
        if (item.experience_years) {
          attribute += ` / ${codeToLabelSingle(EXPERIENCE_YEARS_LABELS, item.experience_years)}`;
        }
      } else if (item.respondent_type === "student" && item.student_year) {
        attribute = codeToLabelSingle(STUDENT_YEAR_LABELS, item.student_year);
      }

      return {
        id: item.id,
        session_id: item.session_id,
        created_at: item.created_at,
        respondent_type: codeToLabelSingle(RESPONDENT_TYPE_LABELS, item.respondent_type),
        respondent_type_code: item.respondent_type,
        university_type: codeToLabelSingle(UNIVERSITY_TYPE_LABELS, item.university_type),
        university_type_code: item.university_type,
        specialty: item.specialty ? codeToLabelSingle(SPECIALTY_LABELS, item.specialty) : null,
        experience_years: item.experience_years
          ? codeToLabelSingle(EXPERIENCE_YEARS_LABELS, item.experience_years)
          : null,
        student_year: item.student_year
          ? codeToLabelSingle(STUDENT_YEAR_LABELS, item.student_year)
          : null,
        attribute,
        challenges: codeToLabel(CHALLENGE_LABELS, item.challenges),
        challenges_code: item.challenges,
        challenge_other: item.challenge_other,
        expectations: codeToLabel(EXPECTATION_LABELS, item.expectations),
        expectations_code: item.expectations,
        expectation_other: item.expectation_other,
        has_chat_log: logMap.has(item.id),
        chat_summary: logMap.get(item.id) || null,
      };
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error("Forms API error:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
