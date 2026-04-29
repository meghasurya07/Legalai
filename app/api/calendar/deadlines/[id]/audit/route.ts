import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from "@/lib/supabase/server";

// GET /api/calendar/deadlines/[id]/audit
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth

        const { id } = await params;

        const { data, error } = await supabase
            .from("deadline_audit_log")
            .select("*")
            .eq("deadline_id", id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) throw error;

        const entries = (data || []).map((e: Record<string, unknown>) => ({
            id: e.id,
            deadlineId: e.deadline_id,
            userId: e.user_id,
            userName: e.user_name,
            action: e.action,
            fieldChanged: e.field_changed,
            oldValue: e.old_value,
            newValue: e.new_value,
            createdAt: e.created_at,
        }));

        return NextResponse.json(entries);
    } catch (err) {
        logger.error("api", "[Deadline Audit GET]", err);
        return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
    }
}