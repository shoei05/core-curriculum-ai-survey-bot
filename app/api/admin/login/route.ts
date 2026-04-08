import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createSessionValue,
  getAdminCredentials,
  validateEnvConfig,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { user, pass } = await req.json();
    const envStatus = validateEnvConfig();

    if (!envStatus.valid) {
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "production"
              ? "管理者認証の環境変数が不足しているため、ログインできません。"
              : "管理者認証に必要な環境変数が設定されていません。",
          missing: envStatus.missing,
        },
        { status: 503 },
      );
    }

    const creds = getAdminCredentials();
    const submittedUser = typeof user === "string" ? user.trim() : "";
    const submittedPass = typeof pass === "string" ? pass : "";

    if (!creds || !submittedUser || !submittedPass) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    }

    if (submittedUser !== creds.user || submittedPass !== creds.pass) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
    }

    const sessionValue = createSessionValue(creds.user, creds.pass);
    if (!sessionValue) {
      return NextResponse.json({ error: "管理者セッションを作成できませんでした" }, { status: 503 });
    }

    const url = new URL(req.url);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: sessionValue,
      httpOnly: true,
      secure: !isLocalhost,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    return response;
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }
}
