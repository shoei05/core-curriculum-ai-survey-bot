import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractKeywords, filterByFrequency, getDateRange } from "@/lib/wordcloud/processor";
import { processToWordCloud } from "@/lib/wordcloud/aggregator";
import type { WordCloudQueryParams } from "@/types/admin";

export const runtime = "nodejs";

/**
 * GET /api/admin/wordcloud
 * Returns word cloud data from survey_logs keyword_groups
 *
 * Query parameters:
 * - timeRange: '7d' | '30d' | '90d' | 'all' (default: 'all')
 * - minFrequency: minimum keyword frequency (default: 2)
 * - maxWords: maximum number of words to return (default: 50)
 */
export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

  try {
    // Parse query parameters
    const url = new URL(req.url);
    const timeRange = (url.searchParams.get("timeRange") as WordCloudQueryParams["timeRange"]) || "all";
    const minFrequency = parseInt(url.searchParams.get("minFrequency") || "2", 10);
    const maxWords = parseInt(url.searchParams.get("maxWords") || "50", 10);

    // Calculate date range filter
    let dateFilter: string | undefined;
    if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateFilter = cutoffDate.toISOString();
    }

    // Fetch logs from Supabase
    let query = supabase
      .from(tableName)
      .select("keyword_groups, created_at")
      .order("created_at", { ascending: false });

    // Apply date filter if specified
    if (dateFilter) {
      query = query.gte("created_at", dateFilter);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        words: [],
        metadata: {
          totalResponses: 0,
          dateRange: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
        },
      });
    }

    // Extract keywords from logs
    const keywords = extractKeywords(logs);

    // Filter by minimum frequency
    const filteredKeywords = filterByFrequency(keywords, minFrequency);

    // Process to word cloud format
    const words = processToWordCloud(filteredKeywords, maxWords);

    // Get date range
    const dateRange = getDateRange(logs);

    return NextResponse.json({
      words,
      metadata: {
        totalResponses: logs.length,
        dateRange,
      },
    });
  } catch (error) {
    console.error("Word cloud API error:", error);
    return NextResponse.json(
      { error: "ワードクラウドデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
