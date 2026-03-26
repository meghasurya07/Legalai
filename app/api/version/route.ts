import { NextResponse } from 'next/server';

/**
 * Returns the current application build version.
 * 
 * NEXT_PUBLIC_BUILD_ID is injected at BUILD TIME by next.config.ts.
 * On Vercel: it's the Git commit SHA (VERCEL_GIT_COMMIT_SHA)
 * On local dev: it's a timestamp from Date.now()
 * 
 * This means:
 * - Old deployment's client has OLD build ID baked in (stored in sessionStorage)
 * - New deployment's /api/version returns NEW build ID
 * - Client detects mismatch → shows "refresh" toast
 */
export async function GET() {
    const version = process.env.NEXT_PUBLIC_BUILD_ID || 'unknown';

    return NextResponse.json(
        { version },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            }
        }
    );
}
