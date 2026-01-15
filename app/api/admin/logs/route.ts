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
        const { data: logs, error } = await supabase
            .from(tableName)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        return NextResponse.json(logs);
    } catch (error) {
        console.error("Logs API error:", error);
        return NextResponse.json({ error: "ログデータの取得に失敗しました" }, { status: 500 });
    }
}
