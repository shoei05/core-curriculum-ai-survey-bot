import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractJson } from "@/lib/survey-helpers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY が設定されていません" }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs, error } = await (supabase as any)
      .from("survey_logs")
      .select("*")
      .or("participant_issue_categories.is.null,participant_issue_categories.eq.[]")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw error;
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        message: "participant-only の未分類ログはありません",
        processed: 0,
        updated: 0,
        failed: 0,
        errors: [],
      });
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const log of logs) {
      processed += 1;

      try {
        const participantMessages =
          Array.isArray(log.participant_messages) && log.participant_messages.length > 0
            ? log.participant_messages
            : (log.messages ?? []).filter((message: { role?: string }) => message.role === "user");

        const transcript = participantMessages
          .map((message: { messageIndex?: number; content?: string }) => {
            const prefix = typeof message.messageIndex === "number" ? `[${message.messageIndex}] ` : "";
            return `${prefix}${message.content ?? ""}`;
          })
          .join("\n");

        const response = await client.chat.completions.create({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: "あなたは質的研究の補助者です。対象は参加者発話のみです。JSONのみを返してください。",
            },
            {
              role: "user",
              content: `以下の participant-only transcript から、参加者が述べた課題をカテゴリ化してください。

出力形式:
{
  "issueCategories": [
    { "category": "カテゴリ名", "items": ["項目1", "項目2"] }
  ]
}

制約:
- 参加者発話のみを使う
- category は簡潔な見出し
- items は参加者の表現に近い短句
- 該当なしなら空配列

participant transcript:
${transcript}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content ?? "";
        const parsed = extractJson(content) as { issueCategories?: Array<{ category: string; items: string[] }> } | null;
        const issueCategories = Array.isArray(parsed?.issueCategories) ? parsed.issueCategories : [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("survey_logs")
          .update({
            participant_issue_categories: issueCategories,
            issue_categories: issueCategories,
          })
          .eq("id", log.id);

        if (updateError) {
          throw updateError;
        }

        updated += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          id: log.id,
          error: error instanceof Error ? error.message : "Unknown error",
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
    console.error("Reclassify issues error:", error);
    return NextResponse.json({ error: "再分類に失敗しました" }, { status: 500 });
  }
}
