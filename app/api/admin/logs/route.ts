import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

    try {
        // Try with explicit columns first, fall back to * if needed
        let logs: any[] | null = null;
        let error: any = null;

        try {
            const result = await supabase
                .from(tableName)
                .select("id, template_slug, created_at, messages, summary_bullets, keyword_groups, issue_categories, competency_categories, core_items")
                .order("created_at", { ascending: false })
                .limit(100);
            logs = result.data;
            error = result.error;
        } catch (e) {
            error = e;
        }

        // If error, try with * (will select all available columns)
        if (error || !logs) {
            console.warn("Some columns not found, using * selector:", error?.message);
            const result = await supabase
                .from(tableName)
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);
            logs = result.data;
            error = result.error;
        }

        if (error) throw error;

        return NextResponse.json(logs);
    } catch (error) {
        console.error("Logs API error:", error);
        return NextResponse.json({ error: "ログデータの取得に失敗しました" }, { status: 500 });
    }
}
