import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";
import { checkRateLimit, RATE_LIMIT_AUTH, RATE_LIMIT_GLOBAL } from "./lib/rate-limit";

const protectedRoutes = ['/documents', '/templates', '/recent-chats', '/settings', '/help', '/super-admin', '/admin'];

// API routes that require authentication (all except auth callbacks)
const publicApiPrefixes = ['/api/auth'];

function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

/**
 * Fire-and-forget security event persistence to system_logs.
 * Lazy-imports the logger to avoid circular deps at module load.
 */
function logSecurityEvent(
    eventType: string,
    data: Record<string, unknown>,
    userId?: string
): void {
    import('./lib/logger').then(({ logEvent }) => {
        logEvent(
            eventType as Parameters<typeof logEvent>[0],
            data,
            undefined,  // projectId
            undefined,  // refId
            undefined,  // orgId
            userId
        )
    }).catch(() => {
        // Fallback: already logged to console, don't block the request
    })
}

export async function proxy(request: NextRequest) {
    const response = await auth0.middleware(request);

    const pathname = request.nextUrl.pathname;
    const isProduction = process.env.NODE_ENV === 'production';
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // ── HTTPS enforcement in production ──────────────────────
    if (isProduction) {
        const proto = request.headers.get('x-forwarded-proto');
        if (proto === 'http') {
            const httpsUrl = new URL(request.url);
            httpsUrl.protocol = 'https:';
            return NextResponse.redirect(httpsUrl, 301);
        }
    }

    // Check if it's a protected page route
    const isProtectedPage = protectedRoutes.some(route => pathname.startsWith(route));

    // Check if it's a protected API route (all /api/* except /api/auth/*)
    const isProtectedApi = pathname.startsWith('/api') && !publicApiPrefixes.some(prefix => pathname.startsWith(prefix));

    // ── Rate limit login attempts by IP ──────────────────────
    if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/auth/login')) {
        const { allowed, remaining } = checkRateLimit(`auth:${ip}`, RATE_LIMIT_AUTH);
        if (!allowed) {
            console.warn(`[SECURITY] RATE_LIMIT_HIT | type=auth | ip=${ip} | path=${pathname}`);
            logSecurityEvent('RATE_LIMIT_HIT', {
                type: 'login_attempt',
                ip,
                path: pathname,
                userAgent: userAgent.slice(0, 200),
                remaining,
            });
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.' },
                { status: 429 }
            );
        }
    }

    if (isProtectedPage || isProtectedApi) {
        const session = await auth0.getSession();
        if (!session) {
            // ── Log failed auth attempt ──────────────────────
            console.warn(`[SECURITY] AUTH_FAILED | path=${pathname} | ip=${ip} | ua=${userAgent.slice(0, 100)}`);
            logSecurityEvent('AUTH_FAILED', {
                path: pathname,
                ip,
                userAgent: userAgent.slice(0, 200),
                routeType: isProtectedApi ? 'api' : 'page',
            });

            if (isProtectedApi) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL('/auth/login', request.url);
            loginUrl.searchParams.set('returnTo', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // ── Global API rate limit per user ───────────────────
        if (isProtectedApi) {
            const userId = session.user.sub;
            const { allowed, remaining } = checkRateLimit(`global:${userId}`, RATE_LIMIT_GLOBAL);
            if (!allowed) {
                console.warn(`[SECURITY] RATE_LIMIT_HIT | type=global | user=${userId} | path=${pathname}`);
                logSecurityEvent('RATE_LIMIT_HIT', {
                    type: 'global_api',
                    path: pathname,
                    ip,
                    remaining,
                }, userId);
                return NextResponse.json(
                    { error: 'Too many requests. Please slow down.' },
                    { status: 429 }
                );
            }
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