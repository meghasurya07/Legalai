import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabase } from "@/lib/supabase/server";

// GET /api/calendar/deadlines/[id]/audit
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        console.error("[Deadline Audit GET]", err);
        return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
    }
}
