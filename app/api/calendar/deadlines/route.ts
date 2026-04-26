import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabase } from "@/lib/supabase/server";

// Helper: map DB row to camelCase
function mapDeadline(d: Record<string, unknown>) {
    return {
        id: d.id,
        userId: d.user_id,
        orgId: d.org_id,
        projectId: d.project_id,
        projectTitle: (d.projects as Record<string, unknown>)?.title || null,
        title: d.title,
        description: d.description,
        deadlineType: d.deadline_type,
        dueAt: d.due_at,
        priority: d.priority,
        status: d.status,
        remindBeforeMinutes: d.remind_before_minutes,
        completedAt: d.completed_at,
        caseNumber: d.case_number,
        courtName: d.court_name,
        judgeName: d.judge_name,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
    };
}

// GET /api/calendar/deadlines?start=ISO&end=ISO&status=pending&priority=high&scope=personal|firm&orgId=xxx
export async function GET(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const { searchParams } = new URL(req.url);
        const start = searchParams.get("start");
        const end = searchParams.get("end");
        const status = searchParams.get("status");
        const priority = searchParams.get("priority");
        const scope = searchParams.get("scope") || "personal";
        const orgId = searchParams.get("orgId");

        let query = supabase
            .from("deadlines")
            .select("*, projects(title)")
            .order("due_at", { ascending: true });

        // Scope filtering
        if (scope === "firm" && orgId) {
            query = query.eq("org_id", orgId);
        } else {
            query = query.eq("user_id", userId);
        }

        if (start) query = query.gte("due_at", start);
        if (end) query = query.lte("due_at", end);
        if (status) query = query.eq("status", status);
        if (priority) query = query.eq("priority", priority);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json((data || []).map(mapDeadline));
    } catch (err) {
        console.error("[Deadlines GET]", err);
        return NextResponse.json({ error: "Failed to fetch deadlines" }, { status: 500 });
    }
}

// POST /api/calendar/deadlines
export async function POST(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const userName = session.user.name || session.user.email || "Unknown";
        const body = await req.json();

        const { data, error } = await supabase
            .from("deadlines")
            .insert({
                user_id: userId,
                org_id: body.orgId || null,
                project_id: body.projectId || null,
                title: body.title,
                description: body.description || null,
                deadline_type: body.deadlineType || "filing",
                due_at: body.dueAt,
                priority: body.priority || "medium",
                status: "pending",
                remind_before_minutes: body.remindBeforeMinutes ?? 1440,
                case_number: body.caseNumber || null,
                court_name: body.courtName || null,
                judge_name: body.judgeName || null,
            })
            .select("*, projects(title)")
            .single();

        if (error) throw error;

        // Audit log: created
        await supabase.from("deadline_audit_log").insert({
            deadline_id: data.id,
            user_id: userId,
            user_name: userName,
            action: "created",
            new_value: data.title,
        });

        return NextResponse.json(mapDeadline(data), { status: 201 });
    } catch (err) {
        console.error("[Deadlines POST]", err);
        return NextResponse.json({ error: "Failed to create deadline" }, { status: 500 });
    }
}
