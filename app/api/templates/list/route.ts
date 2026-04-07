import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getUserId } from '@/lib/get-user-id'

// GET /api/templates/list - Fetch all workflows from DB
export async function GET() {
    try {
        // SECURITY: Require authentication
        const userId = await getUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching workflows:', error)
            return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
        }

        // Transform to match frontend interface
        const workflows = data.map(w => ({
            id: w.id,
            title: w.title,
            description: w.description,
            icon: w.icon
        }))

        return NextResponse.json(workflows)
    } catch (error) {
        console.error('Error in GET /api/templates/list:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
