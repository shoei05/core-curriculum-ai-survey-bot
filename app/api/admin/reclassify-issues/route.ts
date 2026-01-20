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
 * POST /api/admin/reclassify-issues
 * Regenerate issue_categories from user messages for logs with missing/empty issues
 */
export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    // Verify password
    const adminPassword = process.env.ADMIN_PASSWORD;
    console.log("[DEBUG] ADMIN_PASSWORD exists:", !!adminPassword, "length:", adminPassword?.length);
    console.log("[DEBUG] Input password length:", password?.length);
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is not set");
      return NextResponse.json({ error: "サーバー設定エラー: ADMIN_PASSWORDが設定されていません" }, { status: 500 });
    }
    if (!password) {
      return NextResponse.json({ error: "パスワードが入力されていません" }, { status: 401 });
    }
    if (password !== adminPassword) {
      console.log("[DEBUG] Password mismatch");
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    // Fetch logs with missing or empty issue_categories
    const { data: logs, error: fetchError } = await supabase
      .from(tableName)
      .select("id, messages, issue_categories")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (fetchError) throw fetchError;

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        message: "再分類するログが見つかりません",
        processed: 0,
        updated: 0,
        failed: 0,
      });
    }

    // Filter logs that need issue reclassification
    const logsToProcess = logs.filter((log: any) => {
      const issues = log.issue_categories;
      // Process if issue_categories is null, undefined, empty array, or has empty/missing categories
      return !issues ||
             !Array.isArray(issues) ||
             issues.length === 0 ||
             issues.some((cat: any) => !cat.category || !cat.items || cat.items.length === 0);
    });

    if (logsToProcess.length === 0) {
      return NextResponse.json({
        message: "すべてのログに困り事が分類されています",
        processed: logs.length,
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

    for (const logRaw of logsToProcess) {
      const log = logRaw as any;
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

        // Generate issue categories using Gemini
        const response = await client.chat.completions.create({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "あなたは医学教育の専門家です。教員の発言から教育上の困り事を抽出し、分類します。出力は必ずJSONのみ。"
            },
            {
              role: "user",
              content:
                `以下の教員の発言から、教育上の困り事をカテゴリ化して抽出してください。\n\n` +
                `# 出力フォーマット（JSONのみ）\n` +
                `{\n` +
                `  "issueCategories": [\n` +
                `    { "category": "困り事カテゴリ名", "items": ["具体的な困り事1", "具体的な困り事2"] }\n` +
                `  ]\n` +
                `}\n\n` +
                `# 制約\n` +
                `- issueCategoriesは1〜4カテゴリ\n` +
                `- itemsは各カテゴリ1〜4個\n` +
                `- 教育上の困り事に限定（例：学生の学習意欲、教材の不足、時間不足、評価方法、など）\n` +
                `- 発言の中に困り事が含まれていない場合は空配列を返す\n\n` +
                `# 教員の発言\n` +
                `${userMessages}`
            }
          ]
        });

        const content = response.choices[0]?.message?.content ?? "";
        const parsed = extractJson(content);

        if (!parsed || !parsed.issueCategories) {
          errors.push({ id: log.id, error: "JSON parsing failed or issueCategories missing" });
          failed++;
          continue;
        }

        // Update issue_categories
        const { error: updateError } = await (supabase as any)
          .from(tableName)
          .update({ issue_categories: parsed.issueCategories })
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
      message: `困り事の再分類完了: ${updated}件成功、${failed}件失敗`,
      processed,
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("Reclassify issues API error:", error);
    return NextResponse.json(
      { error: "困り事の再分類に失敗しました" },
      { status: 500 }
    );
  }
}
