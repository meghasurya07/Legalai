import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabase } from "@/lib/supabase/server";

// POST /api/calendar/deadlines/batch — Create multiple deadlines at once (for chains)
export async function POST(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const userName = session.user.name || session.user.email || "Unknown";
        const body = await req.json();

        if (!body.deadlines || !Array.isArray(body.deadlines) || body.deadlines.length === 0) {
            return NextResponse.json({ error: "deadlines array is required" }, { status: 400 });
        }

        if (body.deadlines.length > 20) {
            return NextResponse.json({ error: "Maximum 20 deadlines per batch" }, { status: 400 });
        }

        // Get org_id if available
        let orgId: string | null = null;
        try {
            const { getOrgContext } = await import("@/lib/get-org-context");
            const orgCtx = await getOrgContext();
            orgId = orgCtx?.orgId || body.orgId || null;
        } catch {
            orgId = body.orgId || null;
        }

        const chainId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const records = body.deadlines.map((d: Record<string, unknown>) => ({
            user_id: userId,
            org_id: orgId,
            project_id: d.projectId || null,
            title: d.title,
            description: d.description || null,
            deadline_type: d.deadlineType || "custom",
            due_at: d.dueAt,
            priority: d.priority || "medium",
            status: "pending",
            remind_before_minutes: d.remindBeforeMinutes || 1440,
            case_number: d.caseNumber || null,
            court_name: d.courtName || null,
            judge_name: d.judgeName || null,
            chain_id: chainId,
        }));

        const { data, error } = await supabase
            .from("deadlines")
            .insert(records)
            .select("*, projects(title)");

        if (error) throw error;

        // Audit log entries for all created deadlines
        const auditEntries = (data || []).map((d: Record<string, unknown>) => ({
            deadline_id: d.id,
            user_id: userId,
            user_name: userName,
            action: "created",
            field_changed: "chain_create",
            old_value: "",
            new_value: `Created as part of chain: ${chainId}`,
        }));

        if (auditEntries.length > 0) {
            await supabase.from("deadline_audit_log").insert(auditEntries);
        }

        const results = (data || []).map((d: Record<string, unknown>) => ({
            id: d.id,
            userId: d.user_id,
            projectId: d.project_id,
            projectTitle: (d.projects as Record<string, unknown>)?.title || null,
            title: d.title,
            description: d.description,
            deadlineType: d.deadline_type,
            dueAt: d.due_at,
            priority: d.priority,
            status: d.status,
            remindBeforeMinutes: d.remind_before_minutes,
            caseNumber: d.case_number,
            courtName: d.court_name,
            judgeName: d.judge_name,
            chainId: d.chain_id,
            createdAt: d.created_at,
        }));

        return NextResponse.json({ created: results.length, deadlines: results, chainId }, { status: 201 });
    } catch (err) {
        console.error("[Deadlines Batch POST]", err);
        return NextResponse.json({ error: "Failed to create deadline chain" }, { status: 500 });
    }
}
