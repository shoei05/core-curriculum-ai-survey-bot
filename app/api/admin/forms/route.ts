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

    // survey_logsからチャットのみの回答（template_slug="core-curriculum-2026-survey"）を取得
    const { data: chatOnlyLogs, error: chatOnlyLogsError } = await (supabase as any)
      .from("survey_logs")
      .select("*")
      .eq("template_slug", "core-curriculum-2026-survey")
      .order("created_at", { ascending: false });

    if (chatOnlyLogsError) {
      console.error("Chat-only logs fetch error:", chatOnlyLogsError);
    }

    // form_responsesに紐づくチャットログの有無を確認
    const { data: linkedLogs, error: linkedLogsError } = await (supabase as any)
      .from("survey_logs")
      .select("form_response_id, summary_bullets");

    if (linkedLogsError) {
      console.error("Linked survey logs fetch error:", linkedLogsError);
    }

    // チャットログの有無をマッピング
    const logMap = new Map(
      (linkedLogs || []).map((log: any) => [log.form_response_id, log.summary_bullets])
    );

    // チャットのみの回答を2段階調査と同じ形式に変換
    const chatOnlyResponses = (chatOnlyLogs || []).map((item: any) => ({
      id: item.id,
      session_id: item.session_id,
      created_at: item.created_at,
      respondent_type: "チャットのみ（回答者タイプ不明）",
      respondent_type_code: "chat_only",
      university_type: null,
      university_type_code: null,
      specialty: null,
      experience_years: null,
      student_year: null,
      attribute: null,
      challenges: [],
      challenges_code: [],
      challenge_other: null,
      expectations: [],
      expectations_code: [],
      expectation_other: null,
      has_chat_log: true,
      chat_summary: item.summary_bullets || null,
      is_chat_only: true, // チャットのみの回答であることを示すフラグ
    }));

    // レスポンスを変換（2段階調査）
    const formResponsesData = (formResponses || []).map((item: any) => {
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

    // 2種類の調査回答を統合
    const allResponses = [...formResponsesData, ...chatOnlyResponses];

    // 作成日時でソート
    allResponses.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json(allResponses);
  } catch (error) {
    console.error("Forms API error:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
