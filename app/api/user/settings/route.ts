import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { logEvent } from '@/lib/logger';
import { auth0 } from '@/lib/auth0';

export async function GET() {
    try {
        const session = await auth0.getSession();
        const userId = session?.user?.sub || 'default-user-id';

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
        console.error("Error in GET /api/user/settings", error);
        return NextResponse.json({ success: false, error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth0.getSession();
        const userId = session?.user?.sub || 'default-user-id';
        const actor = session?.user?.email || 'system_admin';

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
            actor,
            level: 'user',
            userId,
            changes: updates,
            old_values: oldData
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Error in PATCH /api/user/settings", error);
        return NextResponse.json({ success: false, error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
    }
}
