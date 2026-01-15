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
        const { data: logs, error } = await supabase
            .from(tableName)
            .select("template_slug, issue_categories, competency_categories")
            .order("created_at", { ascending: false });

        if (error) throw error;

        const stats = {
            totalCount: logs.length,
            slugDistribution: {} as Record<string, number>,
            issueDistribution: {} as Record<string, number>,
            competencyDistribution: {} as Record<string, number>,
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
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Stats API error:", error);
        return NextResponse.json({ error: "統計データの取得に失敗しました" }, { status: 500 });
    }
}
