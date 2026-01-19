import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAdminKeys } from "@/lib/auth";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Verify admin password
  const { password } = await req.json();
  const { downloadKey } = getAdminKeys();
  if (password !== downloadKey) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
  }

  const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

  try {
    // Get all logs that have messages but may not have core_items
    interface LogEntry {
      id: string;
      messages: any[];
      template_slug: string;
    }

    const { data: logs, error } = await supabase
      .from(tableName)
      .select("id, messages, template_slug")
      .order("created_at", { ascending: false })
      .limit(1000);

    const typedLogs = (logs || []) as LogEntry[];

    if (error) throw error;

    if (!typedLogs || typedLogs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "再分類対象のログがありません",
        processed: 0,
        updated: 0,
        failed: 0
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

    // Process each log
    for (const log of typedLogs) {
      processed++;

      try {
        const transcript = log.messages
          .map((m: any) => `${m.role === "user" ? "回答者" : "AI"}: ${m.content}`)
          .join("\n");

        const response = await client.chat.completions.create({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "あなたは調査インタビューの記録整理者です。回答者の発言を中心に要点とカテゴリ化したキーワードを抽出します。出力は必ずJSONのみ。"
            },
            {
              role: "user",
              content:
                `以下の会話履歴から、関連するモデル・コア・カリキュラムの項目コードを抽出してください。\n\n` +
                `# 出力フォーマット（JSONのみ）\n` +
                `{\n` +
                `  "coreItems": ["該当するコード（例: PR-01, GE-02）"]\n` +
                `}\n\n` +
                `# 制約\n` +
                `- coreItemsは会話内容に関連するモデル・コア・カリキュラムの項目コード（0〜10個程度）\n` +
                `- 具体的な項目コード例: PR-01（医師の責務）, GE-01（全人的視点）, GE-02（地域の視点）, LL-01（生涯学習）, RE-03（研究の実施）等\n` +
                `- 会話で直接言及されたものや、内容から推察される関連項目を含める\n\n` +
                `# 会話履歴\n` +
                `${transcript}`
            }
          ]
        });

        const content = response.choices[0]?.message?.content ?? "";

        // Extract JSON from response
        let coreItems: string[] = [];
        try {
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
          const jsonStr = jsonMatch?.[1] || content;
          const parsed = JSON.parse(jsonStr);
          coreItems = parsed.coreItems || [];
        } catch (e) {
          // If JSON parsing fails, try to find array-like patterns
          const itemMatches = content.match(/[A-Z]{2}-\d{2}/g);
          if (itemMatches) {
            coreItems = itemMatches;
          }
        }

        // Update core_items column
        const { error: updateError } = await (supabase
          .from(tableName) as any)
          .update({ core_items: coreItems })
          .eq("id", log.id);

        if (updateError) {
          // Column might not exist, try adding it
          console.warn(`Failed to update log ${log.id}:`, updateError);
          failed++;
          errors.push({ id: log.id, error: String(updateError) });
        } else {
          updated++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to reclassify log ${log.id}:`, error);
        failed++;
        errors.push({ id: log.id, error: String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      message: `処理完了: ${processed}件中、${updated}件更新、${failed}件失敗`,
      processed,
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Reclassify API error:", error);
    return NextResponse.json({ error: "再分類に失敗しました" }, { status: 500 });
  }
}
