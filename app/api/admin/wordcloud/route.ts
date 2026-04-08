import { NextResponse } from "next/server";
import { processToWordCloud } from "@/lib/wordcloud/aggregator";
import { extractKeywords, filterByFrequency, getDateRange } from "@/lib/wordcloud/processor";
import { extractUserMessages, tokenizeJapanese } from "@/lib/wordcloud/text-extractor";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { WordCloudQueryParams } from "@/types/admin";

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      Boolean(
        message &&
          typeof message === "object" &&
          "role" in message &&
          "content" in message &&
          (message as { role?: string }).role &&
          typeof (message as { content?: unknown }).content === "string",
      ),
  );
}

function normalizeTopicGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (group): group is { category: string; keywords: string[] } =>
      Boolean(
        group &&
          typeof group === "object" &&
          "category" in group &&
          typeof (group as { category?: unknown }).category === "string" &&
          "keywords" in group &&
          Array.isArray((group as { keywords?: unknown[] }).keywords),
      ),
  );
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    const url = new URL(req.url);
    const timeRange = (url.searchParams.get("timeRange") as WordCloudQueryParams["timeRange"]) || "all";
    const minFrequency = parseInt(url.searchParams.get("minFrequency") || "1", 10);
    const maxWords = parseInt(url.searchParams.get("maxWords") || "100", 10);
    const source =
      (url.searchParams.get("source") as WordCloudQueryParams["source"]) || "participant_messages";

    let dateFilter: string | undefined;
    if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateFilter = cutoffDate.toISOString();
    }

    let query = supabase.from(tableName).select("*").order("created_at", { ascending: false });
    if (dateFilter) {
      query = query.gte("created_at", dateFilter);
    }

    const { data: logs, error } = await query;
    if (error) {
      throw error;
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        words: [],
        metadata: {
          totalResponses: 0,
          dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
          source,
        },
      });
    }

    const rows = logs as Array<Record<string, unknown>>;
    let keywords: string[] = [];

    if (source === "participant_messages") {
      const participantLogs = rows.map((log) => ({
        messages:
          Array.isArray(log.participant_messages) && log.participant_messages.length > 0
            ? normalizeMessages(log.participant_messages)
            : normalizeMessages(log.messages),
        created_at: typeof log.created_at === "string" ? log.created_at : undefined,
      }));
      const participantText = extractUserMessages(participantLogs);
      keywords = await tokenizeJapanese(participantText);
    } else {
      const topicLogs = rows.map((log) => ({
        keyword_groups:
          Array.isArray(log.conversation_topic_groups) && log.conversation_topic_groups.length > 0
            ? normalizeTopicGroups(log.conversation_topic_groups)
            : normalizeTopicGroups(log.keyword_groups),
        created_at: typeof log.created_at === "string" ? log.created_at : undefined,
      }));
      keywords = extractKeywords(topicLogs);
    }

    const filteredKeywords = filterByFrequency(keywords, minFrequency);
    const words = processToWordCloud(filteredKeywords, maxWords);

    return NextResponse.json({
      words,
      metadata: {
        totalResponses: rows.length,
        dateRange: getDateRange(
          rows.map((log) => ({ created_at: typeof log.created_at === "string" ? log.created_at : undefined })),
        ),
        source,
      },
    });
  } catch (error) {
    console.error("Word cloud API error:", error);
    return NextResponse.json({ error: "ワードクラウドデータの取得に失敗しました" }, { status: 500 });
  }
}
