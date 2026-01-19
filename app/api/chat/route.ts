import OpenAI from "openai";
import { z } from "zod";
import { getTemplateBySlug } from "@/lib/templates";

// 入力制限: メッセージ数とコンテンツ長の上限
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 10000;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_CONTENT_LENGTH, "メッセージが長すぎます")
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).max(MAX_MESSAGES, `メッセージは${MAX_MESSAGES}件以下にしてください`).min(1, "最低1件のメッセージが必要です"),
  templateSlug: z.string().optional()
});

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

    const body = BodySchema.parse(json);

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

    const response = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: template.systemPrompt },
        ...body.messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    });

    const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";
    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
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
