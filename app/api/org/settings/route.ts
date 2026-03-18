import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { logEvent } from '@/lib/logger';
import { auth0 } from '@/lib/auth0';

export async function GET() {
    try {
        const session = await auth0.getSession();
        // Fallback to seeded org if no session for this MVP
        const orgId = session?.user?.org_id || '00000000-0000-0000-0000-000000000001';

        const { data, error } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('organization_id', orgId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || {} });
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth0.getSession();
        const orgId = session?.user?.org_id || '00000000-0000-0000-0000-000000000001';
        const actor = session?.user?.email || 'system_admin';

        const body = await request.json();
        const { sanitizeObject } = await import('@/lib/validation');
        const updates = sanitizeObject(body, 10000);

        // Ensure we don't overwrite organization_id
        if (updates.organization_id) delete updates.organization_id;

        const { data: oldData } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('organization_id', orgId)
            .single();

        const { data, error } = await supabase
            .from('organization_settings')
            .upsert({ organization_id: orgId, ...updates, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Log the change
        logEvent('SETTINGS_UPDATE', {
            actor,
            level: 'organization',
            orgId,
            changes: updates,
            old_values: oldData
        });

        return NextResponse.json({ success: true, data });
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
