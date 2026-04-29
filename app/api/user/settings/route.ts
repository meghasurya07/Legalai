import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { logEvent, logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET() {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || {} });
    } catch (error) {
        logger.error("user/settings", "Error in GET /api/user/settings", error);
        return NextResponse.json({ success: false, error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId, userEmail } = auth

        const body = await request.json();
        const { sanitizeObject } = await import('@/lib/validation');
        const updates = sanitizeObject(body, 10000);

        if (updates.user_id) delete updates.user_id;

        const { data: oldData } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        const { data, error } = await supabase
            .from('user_settings')
            .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        logEvent('SETTINGS_UPDATE', {
            actor: userEmail || 'unknown',
            level: 'user',
            userId,
            changes: updates,
            old_values: oldData
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        logger.error("user/settings", "Error in PATCH /api/user/settings", error);
        return NextResponse.json({ success: false, error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
    }
}