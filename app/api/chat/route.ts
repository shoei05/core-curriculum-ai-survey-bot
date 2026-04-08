import OpenAI from "openai";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTemplateBySlug } from "@/lib/templates";
import {
  buildFormContext,
  getChallengeLabels,
  getExpectationLabels,
  getRoleLabel,
} from "@/lib/survey-helpers";
import type { FormResponse } from "@/types/survey";

const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 10000;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(MAX_CONTENT_LENGTH, "メッセージが長すぎます"),
});

const LegacyBodySchema = z.object({
  messages: z.array(MessageSchema).max(MAX_MESSAGES, `メッセージは${MAX_MESSAGES}件以下にしてください`),
  templateSlug: z.string().optional(),
});

const SurveyBodySchema = z.object({
  sessionId: z.string().optional(),
  formResponseId: z.string().min(1),
  respondentType: z.enum(["faculty", "staff", "student", "practitioner"]).optional(),
  messages: z.array(MessageSchema).max(MAX_MESSAGES, `メッセージは${MAX_MESSAGES}件以下にしてください`),
  action: z.enum(["start", "chat"]).optional(),
});

async function handleLegacyChat(json: unknown) {
  const body = LegacyBodySchema.parse(json);
  const templateSlug = body.templateSlug ?? "core-curriculum-2026-survey";
  const template = await getTemplateBySlug(templateSlug);

  if (!template) {
    return new Response(JSON.stringify({ error: "テンプレートが見つかりません" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const apiMessages =
    body.messages.length === 0
      ? [{ role: "user" as const, content: "（初期挨拶をお願いします）" }]
      : body.messages.map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));

  const response = await client.chat.completions.create({
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "system", content: template.systemPrompt }, ...apiMessages],
  });

  const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function fetchFormResponse(formResponseId: string): Promise<Partial<FormResponse>> {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("form_responses").select("*").eq("id", formResponseId).single();

  if (error || !data) {
    throw new Error("フォーム回答が見つかりませんでした");
  }

  return data as Partial<FormResponse>;
}

function createStartMessage(formResponse: Partial<FormResponse>) {
  const roleLabel = getRoleLabel(formResponse.respondent_type);
  const challenges = getChallengeLabels(formResponse.challenges, formResponse.challenge_other);
  const expectations = getExpectationLabels(formResponse.expectations, formResponse.expectation_other);

  if (challenges.length > 0) {
    return `ご回答ありがとうございます。${roleLabel}として「${challenges[0]}」を課題として挙げていただきました。まず、その課題を強く感じた具体的な場面を1つ教えてください。`;
  }

  if (expectations.length > 0) {
    return `ご回答ありがとうございます。${roleLabel}として「${expectations[0]}」に期待されているとのことでした。まず、その期待が高まった背景や現場の状況を教えてください。`;
  }

  return `ご回答ありがとうございます。${roleLabel}として、現行のモデル・コア・カリキュラムで課題を感じた具体的な場面から教えてください。`;
}

function createSurveySystemPrompt(formResponse: Partial<FormResponse>, templatePrompt: string) {
  const contextLines = buildFormContext(formResponse);
  const challengeLabels = getChallengeLabels(formResponse.challenges, formResponse.challenge_other);
  const expectationLabels = getExpectationLabels(formResponse.expectations, formResponse.expectation_other);

  return `${templatePrompt}

## 今回の参加者情報
${contextLines.map((line) => `- ${line}`).join("\n")}

## 今回の対話方針
- 最初の数ターンでは、選択された課題のうち重要度が高そうなものから具体例を深掘りする
- その後、次期改定への期待や改善案へつなげる
- ${challengeLabels.length > 0 ? `選択された課題: ${challengeLabels.join(" / ")}` : "選択された課題が空なら、現場で感じる困りごとを自由に聞く"}
- ${expectationLabels.length > 0 ? `選択された期待: ${expectationLabels.join(" / ")}` : "期待が空なら、改善案や理想像を自由に聞く"}
- 参加者の言葉を研究用語へ置き換えすぎず、短く確認してから次の質問へ進む`;
}

async function handleSurveyChat(json: unknown) {
  const body = SurveyBodySchema.parse(json);
  const template = await getTemplateBySlug("core-curriculum-2026-survey");

  if (!template) {
    return new Response(JSON.stringify({ error: "テンプレートが見つかりません" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const formResponse = await fetchFormResponse(body.formResponseId);

  if (body.action === "start" || body.messages.length === 0) {
    return new Response(JSON.stringify({ message: createStartMessage(formResponse) }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY が設定されていません" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const systemPrompt = createSurveySystemPrompt(formResponse, template.systemPrompt);
  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...body.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
  ];

  const response = await client.chat.completions.create({
    model: "google/gemini-3-flash-preview",
    messages: apiMessages,
    temperature: 0.4,
    max_tokens: 260,
  });

  const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";
  return new Response(JSON.stringify({ message: text, isComplete: false }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json();

    if (json && typeof json === "object" && ("formResponseId" in json || "action" in json)) {
      return await handleSurveyChat(json);
    }

    return await handleLegacyChat(json);
  } catch (error) {
    console.error("Chat API Error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "リクエストの形式が正しくありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (error instanceof Error && "status" in error && (error as { status?: number }).status === 429) {
      return new Response(
        JSON.stringify({ error: "リクエスト数が上限を超えました。しばらく待ってから再度お試しください。" }),
        {
          status: 429,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    }

    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
