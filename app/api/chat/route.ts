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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: template.systemPrompt },
      ...body.messages.map((m) => ({ role: m.role as any, content: m.content }))
    ]
  });

  const text = response.output_text ?? "（応答を生成できませんでした）";
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
