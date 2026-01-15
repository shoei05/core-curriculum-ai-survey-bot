import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "./lib/auth";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const normalizedPath = pathname.replace(/\/$/, "") || "/";

    // Protect /admin routes and /api/admin routes
    const isAdminPath = normalizedPath.startsWith("/admin");
    const isAdminApi = normalizedPath.startsWith("/api/admin");
    const isAuthEp = normalizedPath === "/admin/login" ||
        normalizedPath === "/api/admin/login" ||
        normalizedPath === "/api/admin/logout";

    if ((isAdminPath || isAdminApi) && !isAuthEp) {
        const isAuth = await isAuthenticated(req);
        if (!isAuth) {
            if (isAdminApi) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const url = req.nextUrl.clone();
            url.pathname = "/admin/login";
            url.searchParams.set("error", "session_expired");
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*", "/admin"],
};
