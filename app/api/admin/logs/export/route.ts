import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAdminKeys } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    try {
        const { password } = await req.json();
        const { downloadKey } = getAdminKeys();

        if (password !== downloadKey) {
            return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
        }

        const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

        const { data: logs, error } = await supabase
            .from(tableName)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000); // Higher limit for export

        if (error) throw error;

        // Generate CSV with BOM
        let csvContent = "\uFEFF"; // BOM
        csvContent += "ID,作成日時,テンプレート,やり取り数,サマリー,困り事カテゴリ,資質能力カテゴリ,コアカリ項目\r\n";

        (logs as any[]).forEach(log => {
            const summary = `"${(log.summary_bullets || []).join(" | ").replace(/"/g, '""')}"`;
            const issues = `"${(log.issue_categories || []).map((c: any) => c.category).join(" | ").replace(/"/g, '""')}"`;
            const comps = `"${(log.competency_categories || []).map((c: any) => c.category).join(" | ").replace(/"/g, '""')}"`;
            const coreItems = `"${(log.core_items || []).join(" | ").replace(/"/g, '""')}"`;

            csvContent += `${log.id},${new Date(log.created_at).toLocaleString("ja-JP")},${log.template_slug},${log.messages?.length || 0},${summary},${issues},${comps},${coreItems}\r\n`;
        });

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="survey_logs_${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (error) {
        console.error("Export API error:", error);
        return NextResponse.json({ error: "出力に失敗しました" }, { status: 500 });
    }
}
