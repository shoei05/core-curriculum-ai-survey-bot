import OpenAI from "openai";
import { z } from "zod";
import { getTemplateBySlug } from "@/lib/templates";
import { generateInterviewPrompt, generateInitialGreeting, generateSummaryPrompt } from "@/lib/prompts";
import type { FormResponse } from "@/types/survey";

// 入力制限: メッセージ数とコンテンツ長の上限
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 10000;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(MAX_CONTENT_LENGTH, "メッセージが長すぎます")
});

// 既存システム用（テンプレートベース）
const LegacyBodySchema = z.object({
  messages: z.array(MessageSchema).max(MAX_MESSAGES, `メッセージは${MAX_MESSAGES}件以下にしてください`),
  templateSlug: z.string().optional()
});

// 2段階調査システム用
const SurveyBodySchema = z.object({
  sessionId: z.string().optional(),
  formResponseId: z.string().optional(),
  respondentType: z.enum(["faculty", "staff", "student"]).optional(),
  messages: z.array(MessageSchema).max(MAX_MESSAGES, `メッセージは${MAX_MESSAGES}件以下にしてください`),
  action: z.enum(["start", "chat"]).optional(),
  formData: z.object({
    respondent_type: z.enum(["faculty", "staff", "student"]),
    specialty: z.string().optional(),
    experience_years: z.string().optional(),
    student_year: z.string().optional(),
    challenges: z.array(z.string()).optional(),
    expectations: z.array(z.string()).optional(),
  }).optional(),
});

// 既存システム用（テンプレートベース）
async function handleLegacyChat(json: unknown) {
  const body = LegacyBodySchema.parse(json);

  const templateSlug = body.templateSlug ?? "core-curriculum-2026-survey";
  const template = await getTemplateBySlug(templateSlug);

  if (!template) {
    return new Response(JSON.stringify({ error: "テンプレートが見つかりません" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
  });

  // For initial greeting (empty messages), add a dummy user message to trigger AI response
  const apiMessages = body.messages.length === 0
    ? [{ role: "user" as const, content: "（初期挨拶をお願いします）" }]
    : body.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await client.chat.completions.create({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: template.systemPrompt },
      ...apiMessages
    ]
  });

  const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

// 2段階調査システム用
async function handleSurveyChat(json: unknown) {
  const body = SurveyBodySchema.parse(json);
  const { respondentType, formData, action, messages } = body;

  // フォームデータからプロンプト生成
  const systemPrompt = formData
    ? generateInterviewPrompt(respondentType || "faculty", formData as Partial<FormResponse>)
    : "";

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
  });

  // 開始時の挨拶
  if (action === "start" || messages.length === 0) {
    const greeting = generateInitialGreeting(respondentType || "faculty");
    return new Response(JSON.stringify({ message: greeting }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  // 通常のチャット処理
  const userAssistantMessages = messages.filter((m) => m.role !== "system");
  const MAX_SURVEY_MESSAGES = 14; // 7往復
  const MIN_SURVEY_MESSAGES = 10; // 5往復以上で終了可能

  // 終了判定
  const shouldComplete =
    userAssistantMessages.length >= MAX_SURVEY_MESSAGES ||
    (userAssistantMessages.length >= MIN_SURVEY_MESSAGES &&
     messages[messages.length - 1]?.role === "user");

  if (shouldComplete) {
    // サマリー生成
    const summaryPrompt = generateSummaryPrompt(userAssistantMessages);

    const summaryResponse = await client.chat.completions.create({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "あなたは優秀なアシスタントです。日本語で回答してください。" },
        { role: "user", content: summaryPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const summaryContent = summaryResponse.choices[0]?.message?.content;
    let summaryData = { bullets: [], revision_requests: [], keywords: [] };

    if (summaryContent) {
      try {
        summaryData = JSON.parse(summaryContent);
      } catch (e) {
        console.error("Failed to parse summary:", e);
      }
    }

    // 最終メッセージ（サマリー）
    const finalMessage = `ご協力ありがとうございました！

【まとめ】
${summaryData.bullets.map((b: string) => `• ${b}`).join("\n")}

次期コアカリ改定の検討に活用させていただきます。`;

    // TODO: survey_logsに保存

    return new Response(JSON.stringify({ message: finalMessage, isComplete: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  // 通常のチャット処理
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...userAssistantMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const response = await client.chat.completions.create({
    model: "google/gemini-3-flash-preview",
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";

  return new Response(JSON.stringify({ message: text, isComplete: false }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let json;
    try {
      json = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ error: "JSONのパースに失敗しました" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 2段階調査システム用のリクエストか判定
    if (json && typeof json === "object" && ("respondentType" in json || "action" in json)) {
      return await handleSurveyChat(json);
    }

    // 既存システム用（テンプレートベース）
    return await handleLegacyChat(json);
  } catch (error) {
    console.error("API Error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "リクエストの形式が正しくありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // OpenAI APIエラーの適切なハンドリング
    if (error instanceof Error && "status" in error) {
      const status = (error as any).status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "リクエスト数が上限を超えました。しばらく待ってから再度お試しください。" }), {
          status: 429,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
    }

    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
