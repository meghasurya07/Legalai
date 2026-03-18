import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { logEvent } from '@/lib/logger';
import { getOrgContext } from '@/lib/get-org-context';

export async function GET() {
    try {
        const ctx = await getOrgContext();
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const orgId = ctx.orgId;

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
        const ctx = await getOrgContext();
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const orgId = ctx.orgId;
        const actor = ctx.userId;

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
