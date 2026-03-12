import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

const protectedRoutes = ['/documents', '/templates', '/recent-chats', '/settings', '/help', '/super-admin', '/admin'];

// API routes that require authentication (all except auth callbacks)
const publicApiPrefixes = ['/api/auth'];

export async function proxy(request: NextRequest) {
    const response = await auth0.middleware(request);

    const pathname = request.nextUrl.pathname;

    // Check if it's a protected page route
    const isProtectedPage = protectedRoutes.some(route => pathname.startsWith(route));

    // Check if it's a protected API route (all /api/* except /api/auth/*)
    const isProtectedApi = pathname.startsWith('/api') && !publicApiPrefixes.some(prefix => pathname.startsWith(prefix));

    if (isProtectedPage || isProtectedApi) {
        const session = await auth0.getSession();
        if (!session) {
            if (isProtectedApi) {
                // Return 401 JSON for API routes
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
            // Redirect to login for page routes
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
        "/((?!_next/static|_next/image|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
    ],
};