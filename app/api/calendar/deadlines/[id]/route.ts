import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from "@/lib/supabase/server";

// PATCH /api/calendar/deadlines/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { id } = await params;
        const { userId, userName } = auth
        const body = await req.json();

        // Fetch current state for audit logging
        const { data: current } = await supabase
            .from("deadlines")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const auditEntries: Array<{
            deadline_id: string; user_id: string; user_name: string;
            action: string; field_changed: string; old_value: string; new_value: string;
        }> = [];

        // Track field changes for audit
        const trackChange = (field: string, dbField: string, newVal: unknown) => {
            const oldVal = current[dbField];
            if (String(oldVal) !== String(newVal)) {
                auditEntries.push({
                    deadline_id: id,
                    user_id: userId,
                    user_name: userName,
                    action: field === "status" ? "status_changed" : "field_updated",
                    field_changed: field,
                    old_value: String(oldVal ?? ""),
                    new_value: String(newVal ?? ""),
                });
            }
        };

        if (body.title !== undefined) { updateFields.title = body.title; trackChange("title", "title", body.title); }
        if (body.description !== undefined) { updateFields.description = body.description; trackChange("description", "description", body.description); }
        if (body.deadlineType !== undefined) { updateFields.deadline_type = body.deadlineType; trackChange("deadline_type", "deadline_type", body.deadlineType); }
        if (body.dueAt !== undefined) { updateFields.due_at = body.dueAt; trackChange("due_at", "due_at", body.dueAt); }
        if (body.priority !== undefined) { updateFields.priority = body.priority; trackChange("priority", "priority", body.priority); }
        if (body.projectId !== undefined) { updateFields.project_id = body.projectId; trackChange("project_id", "project_id", body.projectId); }
        if (body.remindBeforeMinutes !== undefined) { updateFields.remind_before_minutes = body.remindBeforeMinutes; }
        if (body.caseNumber !== undefined) { updateFields.case_number = body.caseNumber; trackChange("case_number", "case_number", body.caseNumber); }
        if (body.courtName !== undefined) { updateFields.court_name = body.courtName; trackChange("court_name", "court_name", body.courtName); }
        if (body.judgeName !== undefined) { updateFields.judge_name = body.judgeName; trackChange("judge_name", "judge_name", body.judgeName); }

        if (body.status !== undefined) {
            updateFields.status = body.status;
            trackChange("status", "status", body.status);
            if (body.status === "completed") {
                updateFields.completed_at = new Date().toISOString();
            } else {
                updateFields.completed_at = null;
            }
        }

        const { data, error } = await supabase
            .from("deadlines")
            .update(updateFields)
            .eq("id", id)
            .eq("user_id", userId)
            .select("*, projects(title)")
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Write audit entries
        if (auditEntries.length > 0) {
            await supabase.from("deadline_audit_log").insert(auditEntries);
        }

        return NextResponse.json({
            id: data.id,
            userId: data.user_id,
            projectId: data.project_id,
            projectTitle: (data.projects as Record<string, unknown>)?.title || null,
            title: data.title,
            description: data.description,
            deadlineType: data.deadline_type,
            dueAt: data.due_at,
            priority: data.priority,
            status: data.status,
            remindBeforeMinutes: data.remind_before_minutes,
            completedAt: data.completed_at,
            caseNumber: data.case_number,
            courtName: data.court_name,
            judgeName: data.judge_name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        });
    } catch (err) {
        logger.error("api", "[Deadlines PATCH]", err);
        return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 });
    }
}

// DELETE /api/calendar/deadlines/[id]
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { id } = await params;
        const { userId, userName } = auth

        // Audit log: deleted (before actual delete, since CASCADE will remove logs)
        // Fetch title first
        const { data: existing } = await supabase
            .from("deadlines")
            .select("title")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        const { error } = await supabase
            .from("deadlines")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        // Note: audit entry is cascade-deleted with the deadline.
        // For true deletion auditing, you'd use a separate audit table not linked by FK.
        // For now, the audit trail covers all changes BEFORE deletion.
        logger.info("audit", `Deadline "${existing?.title}" (${id}) deleted by ${userName}`);

        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error("api", "[Deadlines DELETE]", err);
        return NextResponse.json({ error: "Failed to delete deadline" }, { status: 500 });
    }
}