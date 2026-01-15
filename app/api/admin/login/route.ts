import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCredentials } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { user, pass } = await req.json();
        const creds = getAdminCredentials();

        if (user === creds.user && pass === creds.pass) {
            const sessionValue = Buffer.from(`${user}:${pass}`).toString("base64");

            const response = NextResponse.json({ success: true });
            response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
            });

            return response;
        }

        return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
    }
}
