import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAdminCredentials } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // パスワード検証
  const { password } = await req.json();
  const creds = getAdminCredentials();

  if (password !== creds.pass) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  try {
    // 未分類のログを取得（issue_categoriesが空または未定義のもの）
    const { data: logs, error } = await (supabase as any)
      .from("survey_logs")
      .select("*")
      .or("issue_categories.is.null,issue_categories.eq.[]")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Fetch logs error:", error);
      return NextResponse.json({ error: "ログの取得に失敗しました" }, { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        message: "未分類のログはありません",
        processed: 0,
        updated: 0,
        failed: 0,
      });
    }

    // 各ログに対してGeminiで再分類を実行
    let processed = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const log of logs) {
      processed++;
      try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: "https://openrouter.ai/api/v1"
        });

        const transcript = log.messages
          .map((m: any) => `${m.role === "user" ? "回答者" : "AI"}: ${m.content}`)
          .join("\n");

        const response = await client.chat.completions.create({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "あなたは調査インタビューの記録整理者です。回答者の発言を中心に要点とカテゴリ化したキーワードを抽出します。出力は必ずJSONのみ。",
            },
            {
              role: "user",
              content: `以下の会話履歴を要約し、カテゴリ化したキーワードを抽出してください。

# 出力フォーマット（JSONのみ）
{
  "issueCategories": [
    { "category": "カテゴリ名", "items": ["項目1", "項目2"] }
  ]
}

# 制約
- issueCategoriesは「現状の課題・困りごと」をカテゴリ別に整理
- 例：「カリキュラム」「教授法」「評価」「人的資源」「時間・負担」
- 該当する内容がない場合は空配列[]を返してください

# 会話履歴
${transcript}`,
            },
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content in response");
        }

        const parsed = JSON.parse(content);
        const issueCategories = parsed.issueCategories || [];

        // 更新
        const { error: updateError } = await (supabase as any)
          .from("survey_logs")
          .update({ issue_categories: issueCategories })
          .eq("id", log.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated++;
      } catch (err) {
        failed++;
        errors.push({
          id: log.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `処理完了: ${processed}件中 ${updated}件更新、${failed}件失敗`,
      processed,
      updated,
      failed,
      errors,
    });
  } catch (error) {
    console.error("Reclassify error:", error);
    return NextResponse.json({ error: "再分類に失敗しました" }, { status: 500 });
  }
}
