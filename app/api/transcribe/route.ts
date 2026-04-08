import OpenAI from "openai";
import { getTranscriptionCorrectionReference } from "@/lib/knowledge";

const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai";
const DEFAULT_TRANSCRIPTION_MODEL = "voxtral-mini-latest";
const DEFAULT_CORRECTION_MODEL = "google/gemini-3-flash-preview";
const MAX_AUDIO_FILE_BYTES = 4 * 1024 * 1024;

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

async function parseJsonSafe(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function formatErrorMessage(payload: Record<string, unknown>, fallback: string) {
  const error = payload.error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (typeof payload.raw === "string") {
    return payload.raw;
  }

  return fallback;
}

function normalizeCorrectionText(value: string) {
  return value
    .trim()
    .replace(/^```(?:text|markdown)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .replace(/^(修正後|校正後|文字起こし結果)[:：]\s*/u, "")
    .trim();
}

function isCorrectionShapePlausible(rawText: string, correctedText: string) {
  if (rawText.length < 20) {
    return true;
  }

  const ratio = correctedText.length / rawText.length;
  return ratio >= 0.6 && ratio <= 1.4;
}

async function correctTranscriptionText(rawText: string) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return {
      text: rawText,
      correctionApplied: false,
    };
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const response = await client.chat.completions.create({
      model: DEFAULT_CORRECTION_MODEL,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "あなたは日本語の音声文字起こしを校正する担当者です。返答は修正後の本文のみを返してください。説明、注釈、引用符、箇条書き、前置きは禁止です。",
        },
        {
          role: "user",
          content: `以下はモデル・コア・カリキュラム改定事前調査の音声文字起こしです。話者の意図を変えず、モデル・コア・カリキュラム関連の語彙を参考にして、明らかな誤字・誤変換・表記ゆれのみを保守的に修正してください。

制約:
- 要約しない
- 言い換えすぎない
- 文を付け足さない
- 判断できない箇所は元の表現を残す
- 一般語まで過剰に専門用語へ寄せない
- 返答は修正後テキストのみ

参考用語:
${getTranscriptionCorrectionReference()}

文字起こし:
${rawText}`,
        },
      ],
    });

    const correctedText = normalizeCorrectionText(response.choices[0]?.message?.content ?? "");
    if (!correctedText || !isCorrectionShapePlausible(rawText, correctedText)) {
      return {
        text: rawText,
        correctionApplied: false,
      };
    }

    return {
      text: correctedText,
      correctionApplied: correctedText !== rawText,
    };
  } catch (error) {
    console.warn("Transcription correction skipped:", error);
    return {
      text: rawText,
      correctionApplied: false,
    };
  }
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = String(process.env.MISTRAL_API_KEY || "").trim();
    if (!apiKey) {
      return json({ error: "MISTRAL_API_KEY が設定されていません" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const language = String(formData.get("language") || "ja").trim() || "ja";
    const model = String(process.env.MISTRAL_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL).trim();

    if (!(file instanceof File)) {
      return json({ error: "音声ファイルが見つかりませんでした" }, { status: 400 });
    }

    if (file.size === 0) {
      return json({ error: "空の音声ファイルは送信できません" }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_FILE_BYTES) {
      return json({ error: "音声ファイルが大きすぎます。90秒以内の録音でお試しください。" }, { status: 413 });
    }

    const upstreamForm = new FormData();
    upstreamForm.set("model", model);
    upstreamForm.set("language", language);
    upstreamForm.set("file", file, file.name || "survey-input.webm");

    const response = await fetch(`${DEFAULT_MISTRAL_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamForm,
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      const message = formatErrorMessage(payload, `Mistral transcription failed with status ${response.status}`);
      return json({ error: message }, { status: response.status });
    }

    const text = String(payload.text || "").trim();
    if (!text) {
      return json({ error: "文字起こし結果が空でした" }, { status: 502 });
    }

    const corrected = await correctTranscriptionText(text);
    return json({
      text: corrected.text,
      rawText: text,
      correctionApplied: corrected.correctionApplied,
    });
  } catch (error) {
    console.error("Transcribe API Error:", error);
    return json({ error: "音声入力の処理中にエラーが発生しました" }, { status: 500 });
  }
}
