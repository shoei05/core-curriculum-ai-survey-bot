import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "./lib/auth";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Protect /admin routes
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
        const isAuth = await isAuthenticated(req);
        if (!isAuth) {
            const url = req.nextUrl.clone();
            url.pathname = "/admin/login";
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/admin/:path*",
};
