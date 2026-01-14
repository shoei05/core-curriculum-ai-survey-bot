import OpenAI from "openai";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })),
  templateSlug: z.string().optional(),
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
  })).min(1),
  competencyCategories: z.array(z.object({
    category: z.string(),
    items: z.array(z.string()).min(1)
  })).min(1)
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

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });

    const transcript = formatTranscript(body.messages);

    const response = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
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
            `    { "category": "教育上の困り事カテゴリ", "items": ["項目1", "項目2"] }\n` +
            `  ],\n` +
            `  "competencyCategories": [\n` +
            `    { "category": "重要な資質・能力カテゴリ", "items": ["項目1", "項目2"] }\n` +
            `  ]\n` +
            `}\n\n` +
            `# 制約\n` +
            `- summaryBulletsは3〜5個\n` +
            `- keywordGroupsは3〜6カテゴリ\n` +
            `- keywordsは各カテゴリ2〜6個、短い名詞中心\n\n` +
            `- issueCategoriesは1〜4カテゴリ、itemsは各カテゴリ1〜4個\n` +
            `- competencyCategoriesは1〜4カテゴリ、itemsは各カテゴリ1〜4個\n` +
            `- issueCategoriesは「普段の教育の困り事」に対応する内容に限定\n` +
            `- competencyCategoriesは「重要な資質・能力」に対応する内容に限定\n\n` +
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
      competencyCategories: summary.data.competencyCategories
    };

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";
      const insertPayload = {
        template_slug: body.templateSlug ?? "core-curriculum-2026-survey",
        started_at: body.startedAt ?? null,
        ended_at: body.endedAt ?? new Date().toISOString(),
        messages: body.messages,
        summary_bullets: payload.summaryBullets,
        keyword_groups: payload.keywordGroups,
        issue_categories: payload.issueCategories,
        competency_categories: payload.competencyCategories
      };

      const { error: insertError } = await (supabase as unknown as {
        from: (table: string) => {
          insert: (values: Record<string, unknown>[]) => Promise<{ error: unknown | null }>;
        };
      })
        .from(tableName)
        .insert([insertPayload]);

      if (insertError) {
        console.error("Supabase insert error:", insertError);
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
