import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

function base64Encode(value: string) {
    // Standard btoa is available in most modern runtimes including Edge
    // For Node.js, Buffer is preferred but btoa also exists in modern versions.
    if (typeof btoa !== "undefined") {
        // Handle UTF-8 safely for btoa
        const bytes = new TextEncoder().encode(value);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    if (typeof Buffer !== "undefined") {
        return Buffer.from(value).toString("base64");
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
