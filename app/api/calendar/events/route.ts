import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabase } from "@/lib/supabase/server";

// Helper: map DB row to camelCase
function mapEvent(e: Record<string, unknown>) {
    return {
        id: e.id,
        userId: e.user_id,
        orgId: e.org_id,
        projectId: e.project_id,
        projectTitle: (e.projects as Record<string, unknown>)?.title || null,
        title: e.title,
        description: e.description,
        eventType: e.event_type,
        startAt: e.start_at,
        endAt: e.end_at,
        allDay: e.all_day,
        location: e.location,
        recurrenceRule: e.recurrence_rule,
        recurrenceEnd: e.recurrence_end,
        color: e.color,
        caseNumber: e.case_number,
        courtName: e.court_name,
        judgeName: e.judge_name,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
    };
}

// GET /api/calendar/events?start=ISO&end=ISO&scope=personal|firm&orgId=xxx
export async function GET(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const { searchParams } = new URL(req.url);
        const start = searchParams.get("start");
        const end = searchParams.get("end");
        const scope = searchParams.get("scope") || "personal";
        const orgId = searchParams.get("orgId");

        let query = supabase
            .from("calendar_events")
            .select("*, projects(title)")
            .order("start_at", { ascending: true });

        // Scope filtering: personal = my events, firm = all org events
        if (scope === "firm" && orgId) {
            query = query.eq("org_id", orgId);
        } else {
            query = query.eq("user_id", userId);
        }

        if (start) query = query.gte("start_at", start);
        if (end) query = query.lte("start_at", end);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json((data || []).map(mapEvent));
    } catch (err) {
        console.error("[Calendar Events GET]", err);
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }
}

// POST /api/calendar/events
export async function POST(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const body = await req.json();

        // --- Conflict Detection ---
        if (!body.allDay && body.startAt && body.endAt) {
            const { data: conflicts } = await supabase
                .from("calendar_events")
                .select("id, title, start_at, end_at")
                .eq("user_id", userId)
                .lt("start_at", body.endAt)
                .gt("end_at", body.startAt);

            if (conflicts && conflicts.length > 0) {
                // Return conflicts as a warning (client decides to proceed or not)
                const conflictList = conflicts.map((c: Record<string, unknown>) => ({
                    id: c.id,
                    title: c.title,
                    startAt: c.start_at,
                    endAt: c.end_at,
                }));
                // Check if client wants to force-create despite conflicts
                if (!body.forceCreate) {
                    return NextResponse.json({
                        conflict: true,
                        message: `This event overlaps with ${conflicts.length} existing event(s)`,
                        conflicts: conflictList,
                    }, { status: 409 });
                }
            }
        }

        const { data, error } = await supabase
            .from("calendar_events")
            .insert({
                user_id: userId,
                org_id: body.orgId || null,
                project_id: body.projectId || null,
                title: body.title,
                description: body.description || null,
                event_type: body.eventType || "meeting",
                start_at: body.startAt,
                end_at: body.endAt || null,
                all_day: body.allDay || false,
                location: body.location || null,
                recurrence_rule: body.recurrenceRule || null,
                recurrence_end: body.recurrenceEnd || null,
                color: body.color || null,
                case_number: body.caseNumber || null,
                court_name: body.courtName || null,
                judge_name: body.judgeName || null,
            })
            .select("*, projects(title)")
            .single();

        if (error) throw error;

        // Auto-create a matching deadline for filing-type events
        if ((body.eventType || "meeting") === "filing") {
            try {
                await supabase.from("deadlines").insert({
                    user_id: userId,
                    org_id: body.orgId || null,
                    project_id: body.projectId || null,
                    title: body.title,
                    description: body.description || null,
                    deadline_type: "filing",
                    due_at: body.startAt,
                    priority: body.priority || "medium",
                    status: "pending",
                    remind_before_minutes: 1440,
                    case_number: body.caseNumber || null,
                    court_name: body.courtName || null,
                    judge_name: body.judgeName || null,
                });
            } catch (deadlineErr) {
                // Non-blocking — the event was already created
                console.error("[Calendar Events POST] Failed to auto-create deadline:", deadlineErr);
            }
        }

        return NextResponse.json(mapEvent(data), { status: 201 });
    } catch (err) {
        console.error("[Calendar Events POST]", err);
        return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }
}
