import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, createSessionValue, getAdminCredentials } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { user, pass } = await req.json();
        const creds = getAdminCredentials();

        if (user === creds.user && pass === creds.pass) {
            const sessionValue = createSessionValue(user, pass);
            const forwardedProto = req.headers.get("x-forwarded-proto");
            const isSecure = forwardedProto === "https" || new URL(req.url).protocol === "https:";

            const response = NextResponse.json({ success: true });
            response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, {
                httpOnly: true,
                secure: isSecure,
                sameSite: "lax",
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
            });

            // Artificial delay to mitigate brute force
            await new Promise((resolve) => setTimeout(resolve, 800));
            return response;
        }

        // Artificial delay for failed attempts
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
    }
}
