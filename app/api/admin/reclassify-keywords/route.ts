import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Extract JSON from Gemini response
const extractJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    // no-op
  }

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // no-op
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // no-op
    }
  }

  return null;
};

/**
 * POST /api/admin/reclassify-keywords
 * Regenerate keyword_groups from user messages for all logs
 */
export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    // Verify password
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    // Fetch all logs with messages
    const { data: logs, error: fetchError } = await supabase
      .from(tableName)
      .select("id, messages")
      .order("created_at", { ascending: false })
      .limit(1000); // Process up to 1000 logs

    if (fetchError) throw fetchError;

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        message: "再分類するログが見つかりません",
        processed: 0,
        updated: 0,
        failed: 0,
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });

    let processed = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const logRaw of logs) {
      const log = logRaw as any; // Type assertion for dynamic data
      processed++;

      try {
        const messages = (log.messages as any[] | undefined) || [];

        // Extract user messages
        const userMessages = messages
          .filter((m: any) => m.role === "user")
          .map((m: any) => m.content)
          .join("\n");

        if (!userMessages.trim()) {
          // Skip logs without user messages
          continue;
        }

        // Generate keyword groups using Gemini
        const response = await client.chat.completions.create({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "あなたは調査インタビューの記録整理者です。回答者の発言からカテゴリ化したキーワードを抽出します。出力は必ずJSONのみ。"
            },
            {
              role: "user",
              content:
                `以下の回答者の発言からカテゴリ化したキーワードを抽出してください。\n\n` +
                `# 出力フォーマット（JSONのみ）\n` +
                `{\n` +
                `  "keywordGroups": [\n` +
                `    { "category": "カテゴリ名", "keywords": ["キーワード1", "キーワード2"] }\n` +
                `  ]\n` +
                `}\n\n` +
                `# 制約\n` +
                `- keywordGroupsは3〜6カテゴリ\n` +
                `- keywordsは各カテゴリ2〜6個、短い名詞中心\n` +
                `- 回答者の発言の内容を的確に表すキーワードを抽出\n\n` +
                `# 回答者の発言\n` +
                `${userMessages}`
            }
          ]
        });

        const content = response.choices[0]?.message?.content ?? "";
        const parsed = extractJson(content);

        if (!parsed || !parsed.keywordGroups) {
          errors.push({ id: log.id, error: "JSON parsing failed or keywordGroups missing" });
          failed++;
          continue;
        }

        // Update keyword_groups
        const { error: updateError } = await (supabase as any)
          .from(tableName)
          .update({ keyword_groups: parsed.keywordGroups })
          .eq("id", log.id);

        if (updateError) {
          errors.push({ id: log.id, error: updateError.message });
          failed++;
        } else {
          updated++;
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        errors.push({
          id: log.id,
          error: err instanceof Error ? err.message : "Unknown error"
        });
        failed++;
      }
    }

    return NextResponse.json({
      message: `再分類完了: ${updated}件成功、${failed}件失敗`,
      processed,
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("Reclassify keywords API error:", error);
    return NextResponse.json(
      { error: "キーワード再分類に失敗しました" },
      { status: 500 }
    );
  }
}
