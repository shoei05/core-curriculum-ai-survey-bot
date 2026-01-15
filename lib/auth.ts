import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

function base64Encode(value: string) {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(value).toString("base64");
    }
    if (typeof btoa !== "undefined") {
        if (typeof TextEncoder !== "undefined") {
            const bytes = new TextEncoder().encode(value);
            let binary = "";
            bytes.forEach((byte) => {
                binary += String.fromCharCode(byte);
            });
            return btoa(binary);
        }
        return btoa(value);
    }
    return value;
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

export async function isAuthenticated(req: NextRequest) {
    const session = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!session) return false;

    // For simplicity but some safety, sessions are "user:pass" base64 encoded
    // In a real app we'd use JWT, but this meets "Simple Password Auth"
    const { user, pass } = getAdminCredentials();
    const validSession = createSessionValue(user, pass);

    return session === validSession;
}
