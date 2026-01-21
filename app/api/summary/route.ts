import OpenAI from "openai";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })),
  templateSlug: z.string().optional(),
  sessionId: z.string().optional(),
  formResponseId: z.string().uuid().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional()
});

const SummarySchema = z.object({
  summaryBullets: z.array(z.string()).min(1),
  keywordGroups: z.array(z.object({
    category: z.string(),
    keywords: z.array(z.string()).min(1)
  })).min(1),
  issueCategories: z.array(z.object({
    category: z.string(),
    items: z.array(z.string()).min(1)
  })).optional().default([]),
  competencyCategories: z.array(z.object({
    category: z.string(),
    items: z.array(z.string()).min(1)
  })).optional().default([]),
  coreItems: z.array(z.string()).optional()
});

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

const formatTranscript = (messages: { role: string; content: string }[]) =>
  messages.map((m) => `${m.role === "user" ? "回答者" : "AI"}: ${m.content}`).join("\n");

// Convert core item codes to boolean columns (e.g., "PR-01" -> { core_item_pr_01: true })
const coreItemsToColumns = (coreItems: string[]): Record<string, boolean> => {
  const columns: Record<string, boolean> = {};
  coreItems.forEach(item => {
    // Convert "PR-01" to "core_item_pr_01"
    const columnName = `core_item_${item.toLowerCase().replace(/-/g, "_")}`;
    columns[columnName] = true;
  });
  return columns;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    if (body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "サマライズする会話がありません。" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("Supabase admin client unavailable: missing env vars.");
      return new Response(JSON.stringify({ error: "Supabase is not configured (missing env vars)" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });

    const transcript = formatTranscript(body.messages);

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
            `以下の会話履歴を要約し、カテゴリ化したキーワードを抽出してください。\n\n` +
            `# 出力フォーマット（JSONのみ）\n` +
            `{\n` +
            `  "summaryBullets": ["要点1", "要点2", "要点3"],\n` +
            `  "keywordGroups": [\n` +
            `    { "category": "カテゴリ名", "keywords": ["キーワード1", "キーワード2"] }\n` +
            `  ],\n` +
            `  "issueCategories": [\n` +
            `    { "category": "カリキュラム", "items": ["内容が多すぎる", "最新の医療に追いついていない"] },\n` +
            `    { "category": "教授法", "items": ["実習時間が不足", "能動的学修が不十分"] },\n` +
            `    { "category": "評価", "items": ["評価基準が不明確", "客観性に欠ける"] }\n` +
            `  ],\n` +
            `  "competencyCategories": [\n` +
            `    { "category": "医学的知識", "items": ["基礎・臨床の統合", "最新のエビデンス"] },\n` +
            `    { "category": "問題解決能力", "items": ["臨床推論", "クリティカルシンキング"] },\n` +
            `    { "category": "コミュニケーション", "items": ["患者との対話", "チーム医療"] }\n` +
            `  ],\n` +
            `  "coreItems": ["PR-01", "GE-02"]\n` +
            `}\n\n` +
            `# 【重要】分類の作成（必須）\n` +
            `以下の2つの分類は必ず作成してください。会話内容から該当するものを抽出・分類します。\n` +
            `1. issueCategories（困り事・課題の分類）：回答者が挙げた「現状の課題・困りごと」をカテゴリ別に整理\n` +
            `   - 例：「カリキュラム」「教授法」「評価」「人的資源」「時間・負担」\n` +
            `   - 該当する内容がない場合は空配列[]を返してください\n` +
            `2. competencyCategories（資質・能力の分類）：回答者が「重要だ」「育成すべき」と考えた「資質・能力」をカテゴリ別に整理\n` +
            `   - 例：「医学的知識」「問題解決能力」「コミュニケーション」「倫理観」「チーム医療」\n` +
            `   - 該当する内容がない場合は空配列[]を返してください\n\n` +
            `# 制約\n` +
            `- summaryBulletsは3〜5個（全体の要約）\n` +
            `- keywordGroupsは3〜6カテゴリ、keywordsは各カテゴリ2〜6個、短い名詞中心\n` +
            `- issueCategories/competencyCategoriesは各0〜4カテゴリ、itemsは各カテゴリ1〜4個\n` +
            `- 回答者が挙げた具体例を各カテゴリのitemsに含めてください\n` +
            `- coreItemsは会話内容に関連するモデル・コア・カリキュラムの項目コード（0〜10個程度）\n\n` +
            `# 会話履歴\n` +
            `${transcript}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const summary = SummarySchema.safeParse(parsed);

    if (!summary.success) {
      return new Response(JSON.stringify({ error: "サマライズ結果の解析に失敗しました。" }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const payload = {
      summaryBullets: summary.data.summaryBullets,
      keywordGroups: summary.data.keywordGroups,
      issueCategories: summary.data.issueCategories,
      competencyCategories: summary.data.competencyCategories,
      coreItems: summary.data.coreItems ?? []
    };

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    // Convert core items to individual columns for easier aggregation
    const coreItemColumns = coreItemsToColumns(payload.coreItems ?? []);

    const insertPayload = {
      template_slug: body.templateSlug ?? "two-stage-survey",
      session_id: body.sessionId ?? null,
      form_response_id: body.formResponseId ?? null,
      started_at: body.startedAt ?? null,
      ended_at: body.endedAt ?? new Date().toISOString(),
      messages: body.messages,
      summary_bullets: payload.summaryBullets,
      keyword_groups: payload.keywordGroups,
      issue_categories: payload.issueCategories,
      competency_categories: payload.competencyCategories,
      core_items: payload.coreItems,
      ...coreItemColumns
    };

    const supabaseTable = (supabase as unknown as {
      from: (table: string) => {
        insert: (values: Record<string, unknown>[]) => Promise<{ error: any | null }>;
      };
    }).from(tableName);

    const { error: insertError } = await supabaseTable.insert([insertPayload]);

    if (insertError) {
      console.error("Supabase insert error:", insertError);

      const errorMessage = String(insertError?.message ?? "");
      const isMissingColumn =
        errorMessage.includes("column") &&
        (errorMessage.includes("issue_categories") ||
         errorMessage.includes("competency_categories") ||
         errorMessage.includes("core_items") ||
         errorMessage.includes("core_item_"));

      if (isMissingColumn) {
        // Retry with only basic columns (no issue/competency/core_items categories)
        const fallbackPayload = {
          template_slug: insertPayload.template_slug,
          session_id: insertPayload.session_id,
          form_response_id: insertPayload.form_response_id,
          started_at: insertPayload.started_at,
          ended_at: insertPayload.ended_at,
          messages: insertPayload.messages,
          summary_bullets: insertPayload.summary_bullets,
          keyword_groups: insertPayload.keyword_groups,
          issue_categories: insertPayload.issue_categories,
          competency_categories: insertPayload.competency_categories,
          core_items: insertPayload.core_items
        };

        const { error: retryError } = await supabaseTable.insert([fallbackPayload]);
        if (retryError) {
          console.error("Supabase insert retry error:", retryError);
          // Try again with even fewer columns (no core_items, no form_response_id)
          const minimalPayload = {
            template_slug: insertPayload.template_slug,
            started_at: insertPayload.started_at,
            ended_at: insertPayload.ended_at,
            messages: insertPayload.messages,
            summary_bullets: insertPayload.summary_bullets,
            keyword_groups: insertPayload.keyword_groups,
            issue_categories: insertPayload.issue_categories,
            competency_categories: insertPayload.competency_categories
          };
          const { error: minimalError } = await supabaseTable.insert([minimalPayload]);
          if (minimalError) {
            console.error("Supabase insert minimal retry error:", minimalError);
          }
        }
      }
    }

    console.info(JSON.stringify({
      type: "survey_summary",
      createdAt: new Date().toISOString(),
      templateSlug: body.templateSlug ?? "core-curriculum-2026-survey",
      summaryBullets: payload.summaryBullets,
      keywordGroups: payload.keywordGroups,
      issueCategories: payload.issueCategories,
      competencyCategories: payload.competencyCategories,
      coreItems: payload.coreItems,
      messages: body.messages
    }));

    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    console.error("Summary API Error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "リクエストの形式が正しくありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
