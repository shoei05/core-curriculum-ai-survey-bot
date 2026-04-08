import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs, error } = await (supabase as any)
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const stats = {
      totalCount: (logs ?? []).length,
      analysisVersionDistribution: {} as Record<string, number>,
      issueDistribution: {} as Record<string, number>,
      competencyDistribution: {} as Record<string, number>,
      coreItemsDistribution: {} as Record<string, number>,
      sensitivityTopicDistribution: {} as Record<string, number>,
    };

    for (const log of logs ?? []) {
      const analysisVersion = log.analysis_version || "legacy";
      stats.analysisVersionDistribution[analysisVersion] = (stats.analysisVersionDistribution[analysisVersion] || 0) + 1;

      const issueCategories = Array.isArray(log.participant_issue_categories)
        ? log.participant_issue_categories
        : Array.isArray(log.issue_categories)
          ? log.issue_categories
          : [];
      for (const group of issueCategories) {
        if (!group?.category) {
          continue;
        }
        stats.issueDistribution[group.category] = (stats.issueDistribution[group.category] || 0) + 1;
      }

      const competencyCategories = Array.isArray(log.participant_competency_categories)
        ? log.participant_competency_categories
        : Array.isArray(log.competency_categories)
          ? log.competency_categories
          : [];
      for (const group of competencyCategories) {
        if (!group?.category) {
          continue;
        }
        stats.competencyDistribution[group.category] = (stats.competencyDistribution[group.category] || 0) + 1;
      }

      const coreItems = Array.isArray(log.participant_core_items)
        ? log.participant_core_items
        : Array.isArray(log.core_items)
          ? log.core_items
          : [];
      for (const item of coreItems) {
        if (typeof item !== "string" || item.length === 0) {
          continue;
        }
        stats.coreItemsDistribution[item] = (stats.coreItemsDistribution[item] || 0) + 1;
      }

      const sensitivityTopicGroups = Array.isArray(log.coding_sensitivity_topic_groups)
        ? log.coding_sensitivity_topic_groups
        : [];
      for (const group of sensitivityTopicGroups) {
        if (!group?.category) {
          continue;
        }
        stats.sensitivityTopicDistribution[group.category] =
          (stats.sensitivityTopicDistribution[group.category] || 0) + 1;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ error: "統計データの取得に失敗しました" }, { status: 500 });
  }
}
