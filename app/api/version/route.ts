import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cachedVersion: string | null = null;

export async function GET() {
    if (cachedVersion) {
        return NextResponse.json({ version: cachedVersion });
    }

    // 1. Check for common CI/CD commit SHAs (Vercel, Render)
    cachedVersion = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || null;

    // 2. Fallback to Next.js BUILD_ID
    if (!cachedVersion) {
        try {
            const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
            if (fs.existsSync(buildIdPath)) {
                cachedVersion = fs.readFileSync(buildIdPath, 'utf8').trim();
            }
        } catch {
            // Ignore fs errors
        }
    }

    // 3. Last resort fallback
    if (!cachedVersion) {
        cachedVersion = 'development';
    }

    return NextResponse.json(
        { version: cachedVersion },
        {
            headers: {
                'Cache-Control': 'no-store, max-age=0' // Never cache this!
            }
        }
    );
}
