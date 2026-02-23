import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { logEvent } from '@/lib/logger';
import { auth0 } from '@/lib/auth0';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const teamId = params.id;

        const { data, error } = await supabase
            .from('team_settings')
            .select('*')
            .eq('team_id', teamId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || {} });
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const teamId = params.id;
        const session = await auth0.getSession();
        const actor = session?.user?.email || 'system_admin';

        const updates = await request.json();

        if (updates.team_id) delete updates.team_id;

        const { data: oldData } = await supabase
            .from('team_settings')
            .select('*')
            .eq('team_id', teamId)
            .single();

        const { data, error } = await supabase
            .from('team_settings')
            .upsert({ team_id: teamId, ...updates, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        logEvent('SETTINGS_UPDATE', {
            actor,
            level: 'team',
            teamId,
            changes: updates,
            old_values: oldData
        });

        return NextResponse.json({ success: true, data });
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
