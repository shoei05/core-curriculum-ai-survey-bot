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

            // On localhost, we might not have HTTPS. On Vercel, we always should.
            const isLocalhost = req.url.includes("localhost") || req.url.includes("127.0.0.1");
            const finalSecure = isLocalhost ? false : isSecure;

            response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, {
                httpOnly: true,
                secure: finalSecure,
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
