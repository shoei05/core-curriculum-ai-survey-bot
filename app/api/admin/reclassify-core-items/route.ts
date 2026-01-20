import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAdminKeys } from "@/lib/auth";
import OpenAI from "openai";
import { z } from "zod";

const BodySchema = z.object({
  password: z.string(),
  target: z.enum(["core_items", "competency_categories", "both"]).optional().default("both")
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Verify admin password and parse request body
  const json = await req.json();
  const parsedBody = BodySchema.safeParse(json);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const { password, target } = parsedBody.data;
  const { downloadKey } = getAdminKeys();
  if (password !== downloadKey) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
  }

  const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

  // Check if log needs competency category reclassification
  const needsCompetencyReclassification = (log: any): boolean => {
    if (!log.competency_categories) return true;
    if (!Array.isArray(log.competency_categories)) return true;
    if (log.competency_categories.length === 0) return true;
    return log.competency_categories.every((cat: any) => !cat.items || cat.items.length === 0);
  };

  try {
    // Get all logs with messages and existing fields
    interface LogEntry {
      id: string;
      messages: any[];
      template_slug: string;
      core_items?: string[];
      competency_categories?: Array<{ category: string; items: string[] }>;
    }

    const { data: logs, error } = await supabase
      .from(tableName)
      .select("id, messages, template_slug, core_items, competency_categories")
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
        failed: 0,
        target
      });
    }

    // Filter logs based on target
    let logsToProcess = typedLogs;
    if (target === "competency_categories" || target === "both") {
      logsToProcess = logsToProcess.filter(needsCompetencyReclassification);
    }

    if (logsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: "再分類対象のログがありません（既に処理済み）",
        processed: 0,
        updated: 0,
        failed: 0,
        target
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

    // Define prompt based on target
    const getPrompt = (transcript: string): string => {
      if (target === "core_items") {
        return `以下の会話履歴から、関連するモデル・コア・カリキュラムの項目コードを抽出してください。

# 出力フォーマット（JSONのみ）
{
  "coreItems": ["PR-01", "GE-02"]
}

# 制約
- coreItems: 会話内容に関連する項目コード（0〜10個）
- 具体的な項目コード例: PR-01（医師の責務）, GE-01（全人的視点）, GE-02（地域の視点）, LL-01（生涯学習）, RE-03（研究の実施）等
- 会話で直接言及されたものや、内容から推察される関連項目を含める

# 会話履歴
${transcript}`;
      }

      if (target === "competency_categories") {
        return `以下の会話履歴から、資質・能力カテゴリを抽出してください。

# 出力フォーマット（JSONのみ）
{
  "competencyCategories": [
    { "category": "資質・能力コードまたはカテゴリ名", "items": ["具体的な項目1", "項目2"] }
  ]
}

# 資質・能力の10カテゴリ（コードと対応する内容）
- PR（プロフェッショナリズム）: 医師の責務、医療倫理、自己規制
- GE（総合的に患者・生活者をみる姿勢）: 全人的視点、地域の視点
- LL（生涯にわたって共に学ぶ姿勢）: 生涯学習、自己研鑽
- RE（科学的探究）: 研究マインド、科学的思考
- PS（専門知識に基づいた問題解決能力）: 問題解決、臨床推論
- IT（情報・科学技術を活かす能力）: 医療DX、情報活用能力
- CM（コミュニケーション能力）: チーム医療、患者コミュニケーション
- IP（多職種連携能力）: 連携、協働
- SO（社会における医療の役割の理解）: 社会貢献、医療政策
- CS（診療の実践）: 基本的診療技能、実践能力

# 制約
- competencyCategories: 1〜4カテゴリ、各カテゴリ1〜4個の項目
- 会話で直接言及されたものや、内容から推察される関連項目を含める
- カテゴリは上記10コード（PR, GE, LL, RE, PS, IT, CM, IP, SO, CS）または適切な日本語カテゴリ名
- 具体的すぎず、抽象的すぎない適切な粒度で記述

# 会話履歴
${transcript}`;
      }

      // both
      return `以下の会話履歴から、関連するモデル・コア・カリキュラムの項目コードと資質・能力カテゴリを抽出してください。

# 出力フォーマット（JSONのみ）
{
  "coreItems": ["PR-01", "GE-02"],
  "competencyCategories": [
    { "category": "資質・能力コードまたはカテゴリ名", "items": ["具体的な項目1", "項目2"] }
  ]
}

# 資質・能力の10カテゴリ（コードと対応する内容）
- PR（プロフェッショナリズム）: 医師の責務、医療倫理、自己規制
- GE（総合的に患者・生活者をみる姿勢）: 全人的視点、地域の視点
- LL（生涯にわたって共に学ぶ姿勢）: 生涯学習、自己研鑽
- RE（科学的探究）: 研究マインド、科学的思考
- PS（専門知識に基づいた問題解決能力）: 問題解決、臨床推論
- IT（情報・科学技術を活かす能力）: 医療DX、情報活用能力
- CM（コミュニケーション能力）: チーム医療、患者コミュニケーション
- IP（多職種連携能力）: 連携、協働
- SO（社会における医療の役割の理解）: 社会貢献、医療政策
- CS（診療の実践）: 基本的診療技能、実践能力

# 制約
- coreItems: 会話内容に関連する項目コード（0〜10個）
- competencyCategories: 1〜4カテゴリ、各カテゴリ1〜4個の項目
- 会話で直接言及されたものや、内容から推察される関連項目を含める
- カテゴリは上記10コード（PR, GE, LL, RE, PS, IT, CM, IP, SO, CS）または適切な日本語カテゴリ名
- 具体的すぎず、抽象的すぎない適切な粒度で記述

# 会話履歴
${transcript}`;
    };

    // Schema for competency categories validation
    const CompetencyCategorySchema = z.object({
      category: z.string(),
      items: z.array(z.string()).min(1)
    });

    // Process each log
    for (const log of logsToProcess) {
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
              content: getPrompt(transcript)
            }
          ]
        });

        const content = response.choices[0]?.message?.content ?? "";

        // Extract JSON from response
        const extractJson = (text: string): any => {
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

        const parsed = extractJson(content);
        if (!parsed) {
          throw new Error("JSONの解析に失敗しました");
        }

        // Prepare update data based on target
        const updateData: any = {};

        if (target === "core_items" || target === "both") {
          if (parsed.coreItems && Array.isArray(parsed.coreItems)) {
            updateData.core_items = parsed.coreItems;
          }
        }

        if (target === "competency_categories" || target === "both") {
          if (parsed.competencyCategories && Array.isArray(parsed.competencyCategories)) {
            // Validate competency categories
            const validatedCategories = parsed.competencyCategories
              .map((cat: any) => {
                const result = CompetencyCategorySchema.safeParse(cat);
                return result.success ? result.data : null;
              })
              .filter((cat: any): cat is z.infer<typeof CompetencyCategorySchema> => cat !== null);

            if (validatedCategories.length > 0) {
              updateData.competency_categories = validatedCategories;
            }
          }
        }

        // Skip if no data to update
        if (Object.keys(updateData).length === 0) {
          console.warn(`No valid data extracted for log ${log.id}`);
          failed++;
          errors.push({ id: log.id, error: "有効なデータを抽出できませんでした" });
          continue;
        }

        // Update database
        const { error: updateError } = await (supabase
          .from(tableName) as any)
          .update(updateData)
          .eq("id", log.id);

        if (updateError) {
          const errorMsg = updateError?.message || String(updateError);
          const errorHint = updateError?.hint || "";
          const errorDetails = errorHint ? `${errorMsg} (${errorHint})` : errorMsg;

          console.warn(`Failed to update log ${log.id}:`, updateError);
          failed++;
          errors.push({ id: log.id, error: errorDetails });
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
      target,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Reclassify API error:", error);
    return NextResponse.json({ error: "再分類に失敗しました" }, { status: 500 });
  }
}
