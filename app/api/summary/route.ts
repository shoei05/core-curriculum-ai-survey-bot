import OpenAI from "openai";
import { z } from "zod";
import { extractJson, formatTranscript } from "@/lib/survey-helpers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { FormResponse, SummaryApiResponse } from "@/types/survey";

const ANALYSIS_VERSION = "2026-04-08";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1),
  templateSlug: z.string().optional(),
  sessionId: z.string().optional(),
  formResponseId: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  summaryScope: z.enum(["conversation_all", "participant_only"]).default("conversation_all"),
  codingScope: z.enum(["participant_only", "conversation_all"]).default("participant_only"),
  codingMethod: z.enum(["in_vivo", "topic"]).default("in_vivo"),
  runSensitivityCoding: z.boolean().default(true),
});

const TopicGroupSchema = z.object({
  category: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
});

const CategoryGroupSchema = z.object({
  category: z.string().min(1),
  items: z.array(z.string().min(1)).default([]),
});

const SummaryViewPayloadSchema = z.object({
  summaryBullets: z.array(z.string().min(1)).min(1),
  topicGroups: z.array(TopicGroupSchema).default([]),
});

const CodingPrimaryPayloadSchema = z.object({
  inVivoCodes: z
    .array(
      z.object({
        code: z.string().min(1),
        quote: z.string().optional(),
        messageIndex: z.coerce.number().int().optional(),
      }),
    )
    .default([]),
  issueCategories: z.array(CategoryGroupSchema).default([]),
  competencyCategories: z.array(CategoryGroupSchema).default([]),
  coreItems: z.array(z.string().min(1)).default([]),
});

const CodingSensitivityPayloadSchema = z.object({
  topicGroups: z.array(TopicGroupSchema).default([]),
});

function normalizeTopicGroups(
  groups: Array<{ category: string; keywords?: string[] }> | undefined,
) {
  return (groups ?? []).map((group) => ({
    category: group.category,
    keywords: group.keywords ?? [],
  }));
}

function normalizeCategoryGroups(
  groups: Array<{ category: string; items?: string[] }> | undefined,
) {
  return (groups ?? []).map((group) => ({
    category: group.category,
    items: group.items ?? [],
  }));
}

function createClient() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

async function runJsonPrompt<T>(
  client: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const response = await client.chat.completions.create({
    model: "google/gemini-3-flash-preview",
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  return schema.parse(parsed);
}

async function fetchRespondentType(formResponseId?: string) {
  if (!formResponseId) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("form_responses").select("respondent_type").eq("id", formResponseId).single();
  return (data as Partial<FormResponse> | null)?.respondent_type ?? null;
}

function buildParticipantMessages(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return messages
    .map((message, index) => ({ ...message, messageIndex: index }))
    .filter((message) => message.role === "user");
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const client = createClient();

    const participantMessages = buildParticipantMessages(body.messages);
    const assistantMessageCount = body.messages.filter((message) => message.role === "assistant").length;
    const fullTranscript = formatTranscript(body.messages);
    const participantTranscript = participantMessages
      .map((message) => `[${message.messageIndex}] 参加者: ${message.content}`)
      .join("\n");

    const summaryPayload = await runJsonPrompt(
      client,
      "あなたは調査インタビューの記録整理者です。対象は会話全体です。出力はJSONのみで返してください。",
      `以下の会話全体を、参加者にも読みやすいサマリーに整理してください。

出力形式:
{
  "summaryBullets": ["要点1", "要点2"],
  "topicGroups": [
    { "category": "カテゴリ名", "keywords": ["キーワード1", "キーワード2"] }
  ]
}

制約:
- summaryBulletsは3〜5項目を目安に、会話全体の要点を簡潔にまとめる
- topicGroupsは会話全体で観察された話題群を整理する
- AI発話も会話の文脈として含めてよいが、参加者の主張を優先してまとめる

会話:
${fullTranscript}`,
      SummaryViewPayloadSchema,
    );

    const codingPrimaryPayload =
      participantMessages.length === 0
        ? {
            inVivoCodes: [],
            issueCategories: [],
            competencyCategories: [],
            coreItems: [],
          }
        : await runJsonPrompt(
            client,
            "あなたは質的研究の補助者です。対象は参加者発話のみです。主要分析として participant-only の in vivo coding を行い、JSONのみを返してください。",
            `以下は参加者発話のみの記録です。括弧の数字は元メッセージ index です。

出力形式:
{
  "inVivoCodes": [
    { "code": "参加者の短い表現", "quote": "元発話の抜粋", "messageIndex": 3 }
  ],
  "issueCategories": [
    { "category": "カテゴリ名", "items": ["項目1", "項目2"] }
  ],
  "competencyCategories": [
    { "category": "カテゴリ名", "items": ["項目1", "項目2"] }
  ],
  "coreItems": ["PR-01"]
}

制約:
- inVivoCodes は参加者自身の表現を短句として切り出す
- quote は短い代表引用にする
- messageIndex は括弧内の index をそのまま使う
- issueCategories は参加者が述べた課題を整理する
- competencyCategories は参加者が重要とみなした資質・能力を整理する
- coreItems は関連するモデル・コア・カリキュラム項目コードがあれば入れる。なければ空配列でもよい

参加者発話:
${participantTranscript}`,
            CodingPrimaryPayloadSchema,
          );

    const codingSensitivityPayload = body.runSensitivityCoding
      ? await runJsonPrompt(
          client,
          "あなたは調査会話の感度分析を行う補助者です。対象は会話全体です。JSONのみを返してください。",
          `以下の会話全体について、主要分析ではなく感度分析として descriptive/topic coding を行ってください。

出力形式:
{
  "topicGroups": [
    { "category": "カテゴリ名", "keywords": ["キーワード1", "キーワード2"] }
  ]
}

制約:
- AIの問いかけも含めた会話全体で観察された話題群を整理する
- category は短い見出しにする
- keywords は各カテゴリにつき2〜6語程度

会話:
${fullTranscript}`,
          CodingSensitivityPayloadSchema,
        )
      : { topicGroups: [] };

    const summaryResponse: SummaryApiResponse = {
      summaryView: {
        scope: body.summaryScope,
        summaryBullets: summaryPayload.summaryBullets,
        topicGroups: normalizeTopicGroups(summaryPayload.topicGroups),
      },
      codingPrimary: {
        scope: body.codingScope,
        method: body.codingMethod,
        inVivoCodes: codingPrimaryPayload.inVivoCodes ?? [],
        issueCategories: normalizeCategoryGroups(codingPrimaryPayload.issueCategories),
        competencyCategories: normalizeCategoryGroups(codingPrimaryPayload.competencyCategories),
        coreItems: codingPrimaryPayload.coreItems ?? [],
      },
      codingSensitivity: {
        scope: "conversation_all",
        method: "topic",
        topicGroups: normalizeTopicGroups(codingSensitivityPayload.topicGroups),
      },
      analysisMeta: {
        analysisVersion: ANALYSIS_VERSION,
        messageCount: body.messages.length,
        participantMessageCount: participantMessages.length,
        assistantMessageCount,
      },
    };

    const insertPayload = {
      template_slug: body.templateSlug ?? "two-stage-survey",
      session_id: body.sessionId ?? null,
      form_response_id: body.formResponseId ?? null,
      respondent_type: await fetchRespondentType(body.formResponseId),
      started_at: body.startedAt ?? null,
      ended_at: body.endedAt ?? new Date().toISOString(),
      messages: body.messages,
      summary_bullets: summaryResponse.summaryView.summaryBullets,
      keyword_groups: summaryResponse.summaryView.topicGroups,
      issue_categories: summaryResponse.codingPrimary.issueCategories,
      competency_categories: summaryResponse.codingPrimary.competencyCategories,
      core_items: summaryResponse.codingPrimary.coreItems,
      conversation_summary_bullets: summaryResponse.summaryView.summaryBullets,
      conversation_topic_groups: summaryResponse.summaryView.topicGroups,
      participant_messages: participantMessages,
      participant_in_vivo_codes: summaryResponse.codingPrimary.inVivoCodes,
      participant_issue_categories: summaryResponse.codingPrimary.issueCategories,
      participant_competency_categories: summaryResponse.codingPrimary.competencyCategories,
      participant_core_items: summaryResponse.codingPrimary.coreItems,
      coding_sensitivity_topic_groups: summaryResponse.codingSensitivity.topicGroups,
      assistant_probe_tags: [],
      summary_scope: summaryResponse.summaryView.scope,
      coding_scope: summaryResponse.codingPrimary.scope,
      coding_method: summaryResponse.codingPrimary.method,
      analysis_version: ANALYSIS_VERSION,
    };

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let insertResult = await (supabase as any).from(tableName).insert([insertPayload]);

    if (insertResult.error) {
      const errorMessage = String(insertResult.error.message ?? "");
      const isMissingNewColumn =
        errorMessage.includes("column") &&
        (errorMessage.includes("conversation_summary_bullets") ||
          errorMessage.includes("participant_messages") ||
          errorMessage.includes("participant_in_vivo_codes") ||
          errorMessage.includes("coding_sensitivity_topic_groups") ||
          errorMessage.includes("summary_scope") ||
          errorMessage.includes("analysis_version"));

      if (isMissingNewColumn) {
        const legacyPayload = {
          template_slug: insertPayload.template_slug,
          session_id: insertPayload.session_id,
          form_response_id: insertPayload.form_response_id,
          respondent_type: insertPayload.respondent_type,
          started_at: insertPayload.started_at,
          ended_at: insertPayload.ended_at,
          messages: insertPayload.messages,
          summary_bullets: insertPayload.summary_bullets,
          keyword_groups: insertPayload.keyword_groups,
          issue_categories: insertPayload.issue_categories,
          competency_categories: insertPayload.competency_categories,
          core_items: insertPayload.core_items,
        };
        insertResult = await (supabase as any).from(tableName).insert([legacyPayload]);
      }
    }

    if (insertResult.error) {
      console.error("Summary insert error:", insertResult.error);
    }

    return new Response(JSON.stringify(summaryResponse), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("Summary API Error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "リクエストの形式が正しくありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
