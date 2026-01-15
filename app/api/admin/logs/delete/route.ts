import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAdminCredentials } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    try {
        const { id, password } = await req.json();
        const creds = getAdminCredentials();

        // Extra verification with password
        if (password !== creds.pass) {
            return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
        }

        const tableName = process.env.SUPABASE_SURVEY_LOG_TABLE ?? "survey_logs";

        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete API error:", error);
        return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
    }
}
