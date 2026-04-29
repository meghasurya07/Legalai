import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth'
import { supabase } from "@/lib/supabase/server";

// PATCH /api/calendar/events/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        const { id } = await params;
        const body = await req.json();

        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) updateFields.title = body.title;
        if (body.description !== undefined) updateFields.description = body.description;
        if (body.eventType !== undefined) updateFields.event_type = body.eventType;
        if (body.startAt !== undefined) updateFields.start_at = body.startAt;
        if (body.endAt !== undefined) updateFields.end_at = body.endAt;
        if (body.allDay !== undefined) updateFields.all_day = body.allDay;
        if (body.location !== undefined) updateFields.location = body.location;
        if (body.projectId !== undefined) updateFields.project_id = body.projectId;
        if (body.recurrenceRule !== undefined) updateFields.recurrence_rule = body.recurrenceRule;
        if (body.recurrenceEnd !== undefined) updateFields.recurrence_end = body.recurrenceEnd;
        if (body.color !== undefined) updateFields.color = body.color;
        if (body.caseNumber !== undefined) updateFields.case_number = body.caseNumber;
        if (body.courtName !== undefined) updateFields.court_name = body.courtName;
        if (body.judgeName !== undefined) updateFields.judge_name = body.judgeName;

        const { data, error } = await supabase
            .from("calendar_events")
            .update(updateFields)
            .eq("id", id)
            .eq("user_id", userId)
            .select("*, projects(title)")
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({
            id: data.id,
            userId: data.user_id,
            projectId: data.project_id,
            projectTitle: (data.projects as Record<string, unknown>)?.title || null,
            title: data.title,
            description: data.description,
            eventType: data.event_type,
            startAt: data.start_at,
            endAt: data.end_at,
            allDay: data.all_day,
            location: data.location,
            color: data.color,
            caseNumber: data.case_number,
            courtName: data.court_name,
            judgeName: data.judge_name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        });
    } catch (err) {
        logger.error("api", "[Calendar Events PATCH]", err);
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
}

// DELETE /api/calendar/events/[id]
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth
        const { id } = await params;

        const { error } = await supabase
            .from("calendar_events")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error("api", "[Calendar Events DELETE]", err);
        return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
    }
}