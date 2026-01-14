import OpenAI from "openai";
import { z } from "zod";
import { getTemplateBySlug } from "@/lib/templates";

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  templateSlug: z.string().optional()
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json();
  const body = BodySchema.parse(json);

  const templateSlug = body.templateSlug ?? "core-curriculum-2026-survey";
  const template = await getTemplateBySlug(templateSlug);

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
  });

  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: template.systemPrompt },
      ...body.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    ]
  });

  const text = response.choices[0]?.message?.content ?? "（応答を生成できませんでした）";
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
