import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    try {
        // 1. Get all logs for aggregation
        // First try with core_items, fall back to without if column doesn't exist
        let logs: any[] | null = null;
        let error: any = null;

        try {
            const result = await supabase
                .from(tableName)
                .select("template_slug, issue_categories, competency_categories, core_items")
                .order("created_at", { ascending: false });
            logs = result.data;
            error = result.error;
        } catch (e) {
            error = e;
        }

        // If error, try without core_items column
        if (error || !logs) {
            console.warn("core_items column not found, retrying without it:", error?.message);
            const result = await supabase
                .from(tableName)
                .select("template_slug, issue_categories, competency_categories")
                .order("created_at", { ascending: false });
            logs = result.data;
            error = result.error;
        }

        if (error) throw error;

        if (!logs) {
            return NextResponse.json({
                totalCount: 0,
                slugDistribution: {},
                issueDistribution: {},
                competencyDistribution: {},
                coreItemsDistribution: {},
            });
        }

        const stats = {
            totalCount: logs.length,
            slugDistribution: {} as Record<string, number>,
            issueDistribution: {} as Record<string, number>,
            competencyDistribution: {} as Record<string, number>,
            coreItemsDistribution: {} as Record<string, number>,
        };

        (logs as any[]).forEach((log) => {
            // Slug dist
            const slug = log.template_slug || "unknown";
            stats.slugDistribution[slug] = (stats.slugDistribution[slug] || 0) + 1;

            // Issue dist
            const issues = log.issue_categories || [];
            issues.forEach((group: any) => {
                const cat = group.category;
                stats.issueDistribution[cat] = (stats.issueDistribution[cat] || 0) + 1;
            });

            // Competency dist
            const comps = log.competency_categories || [];
            comps.forEach((group: any) => {
                const cat = group.category;
                stats.competencyDistribution[cat] = (stats.competencyDistribution[cat] || 0) + 1;
            });

            // Core items dist (only if available)
            const coreItems = log.core_items || [];
            coreItems.forEach((item: string) => {
                stats.coreItemsDistribution[item] = (stats.coreItemsDistribution[item] || 0) + 1;
            });
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Stats API error:", error);
        return NextResponse.json({ error: "統計データの取得に失敗しました" }, { status: 500 });
    }
}
