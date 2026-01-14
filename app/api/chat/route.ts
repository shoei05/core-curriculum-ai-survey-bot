import OpenAI from "openai";
import { z } from "zod";
import { getTemplateBySlug } from "@/lib/templates";

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),  // Strict role validation
    content: z.string()
  })),
  templateSlug: z.string().optional()
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    const templateSlug = body.templateSlug ?? "core-curriculum-2026-survey";
    const template = await getTemplateBySlug(templateSlug);

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

    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
