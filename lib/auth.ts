import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";

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
    const validSession = Buffer.from(`${user}:${pass}`).toString("base64");

    return session === validSession;
}
