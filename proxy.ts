import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

const protectedRoutes = ['/documents', '/templates', '/recent-chats', '/settings', '/help'];

export async function proxy(request: NextRequest) {
    const response = await auth0.middleware(request);

    const pathname = request.nextUrl.pathname;
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtected) {
        const session = await auth0.getSession();
        if (!session) {
            const loginUrl = new URL('/auth/login', request.url);
            loginUrl.searchParams.set('returnTo', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};