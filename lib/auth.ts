import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

/**
 * 環境変数の設定を検証
 * 本番環境では必須項目が設定されていることを確認
 */
export function validateEnvConfig(): { valid: boolean; missing: string[] } {
    const isProduction = process.env.NODE_ENV === "production";
    const missing: string[] = [];

    if (isProduction) {
        if (!process.env.ADMIN_USER) missing.push("ADMIN_USER");
        if (!process.env.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
        if (!process.env.ADMIN_SESSION_SECRET) missing.push("ADMIN_SESSION_SECRET");
        if (!process.env.ADMIN_DELETE_KEY) missing.push("ADMIN_DELETE_KEY");
        if (!process.env.ADMIN_DOWNLOAD_KEY) missing.push("ADMIN_DOWNLOAD_KEY");
    }

    return { valid: missing.length === 0, missing };
}

function base64Encode(value: string) {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(value).toString("base64");
    }
    // Fallback for environment without Buffer (Edge Runtime)
    // Secure UTF-8 to Base64
    return btoa(unescape(encodeURIComponent(value)));
}

export function getAdminSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || "default_survey_secret_key_123";
}

export function createSessionValue(user: string, pass: string) {
    const secret = getAdminSessionSecret();
    return base64Encode(`${user}:${pass}:${secret}`);
}

export function getAdminCredentials() {
    return {
        user: process.env.ADMIN_USER || "admin",
        pass: process.env.ADMIN_PASSWORD || "password123",
    };
}

export function getAdminKeys() {
    return {
        deleteKey: process.env.ADMIN_DELETE_KEY || process.env.ADMIN_PASSWORD || "password123",
        downloadKey: process.env.ADMIN_DOWNLOAD_KEY || process.env.ADMIN_PASSWORD || "password123",
    };
}

export async function isAuthenticated(req: NextRequest) {
    const session = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

    if (!session) return false;

    // For simplicity but some safety, sessions are "user:pass:secret" base64 encoded
    // In a real app we'd use JWT, but this meets "Simple Password Auth"
    const { user, pass } = getAdminCredentials();
    const validSession = createSessionValue(user, pass);

    return session === validSession;
}
