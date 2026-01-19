import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

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
        pass: process.env.ADMIN_PASS || "password123",
    };
}

export function getAdminKeys() {
    return {
        deleteKey: process.env.ADMIN_DELETE_KEY || process.env.ADMIN_PASS || "password123",
        downloadKey: process.env.ADMIN_DOWNLOAD_KEY || process.env.ADMIN_PASS || "password123",
    };
}

export async function isAuthenticated(req: NextRequest) {
    const session = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

    console.log("[AUTH] Checking authentication:", {
        hasCookie: !!session,
        cookieName: ADMIN_COOKIE_NAME,
        cookieValue: session?.substring(0, 20) + "...",
        allCookies: req.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
    });

    if (!session) return false;

    // For simplicity but some safety, sessions are "user:pass" base64 encoded
    // In a real app we'd use JWT, but this meets "Simple Password Auth"
    const { user, pass } = getAdminCredentials();
    const validSession = createSessionValue(user, pass);

    const isValid = session === validSession;
    console.log("[AUTH] Validation result:", { isValid });

    return isValid;
}
