import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "./lib/auth";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Protect /admin routes and /api/admin routes
    // Exclude login/logout from auth requirement
    const isAdminPath = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    const isAuthEp = pathname === "/admin/login" || pathname === "/api/admin/login" || pathname === "/api/admin/logout";

    if ((isAdminPath || isAdminApi) && !isAuthEp) {
        const isAuth = await isAuthenticated(req);
        if (!isAuth) {
            if (isAdminApi) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const url = req.nextUrl.clone();
            url.pathname = "/admin/login";
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
