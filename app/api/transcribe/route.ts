import { getTranscriptionContextBiasTerms } from "@/lib/knowledge";

const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai";
const DEFAULT_TRANSCRIPTION_MODEL = "voxtral-mini-latest";
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

function normalizeDomainTerms(text: string) {
  return text
    .replace(/医学教育モデル[\s・-]*コア[\s・-]*カリキュラム/gu, "医学教育モデル・コア・カリキュラム")
    .replace(/モデル[\s・-]*コア[\s・-]*カリキュラム/gu, "モデル・コア・カリキュラム")
    .replace(/コア[\s・-]*カリ/gu, "コアカリ")
    .replace(/アウトカム[\s・-]*基盤型教育/gu, "アウトカム基盤型教育")
    .replace(/診療参加型[\s・-]*臨床実習/gu, "診療参加型臨床実習")
    .replace(/プライマリ[\s・-]*ケア/gu, "プライマリ・ケア")
    .replace(/リサーチ[\s・-]*マインド/gu, "リサーチマインド");
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
    upstreamForm.set("context_bias", getTranscriptionContextBiasTerms().join(","));

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

    const text = normalizeDomainTerms(String(payload.text || "").trim());
    if (!text) {
      return json({ error: "文字起こし結果が空でした" }, { status: 502 });
    }

    return json({ text });
  } catch (error) {
    console.error("Transcribe API Error:", error);
    return json({ error: "音声入力の処理中にエラーが発生しました" }, { status: 500 });
  }
}
