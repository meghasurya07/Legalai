import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { supabase } from "@/lib/supabase/server";

// GET /api/calendar/stats
export async function GET() {
    try {
        const session = await auth0.getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.sub;
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const next7Days = new Date(now);
        next7Days.setDate(now.getDate() + 7);

        // Upcoming events + deadlines in next 7 days
        const [eventsRes, deadlinesUpcoming, deadlinesOverdue, deadlinesThisWeek, deadlinesCompleted] = await Promise.all([
            supabase
                .from("calendar_events")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .gte("start_at", now.toISOString())
                .lte("start_at", next7Days.toISOString()),
            supabase
                .from("deadlines")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .in("status", ["pending", "in_progress"])
                .gte("due_at", now.toISOString())
                .lte("due_at", next7Days.toISOString()),
            supabase
                .from("deadlines")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .in("status", ["pending", "in_progress"])
                .lt("due_at", now.toISOString()),
            supabase
                .from("deadlines")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .in("status", ["pending", "in_progress"])
                .gte("due_at", startOfWeek.toISOString())
                .lte("due_at", endOfWeek.toISOString()),
            supabase
                .from("deadlines")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("status", "completed")
                .gte("completed_at", startOfMonth.toISOString())
                .lte("completed_at", endOfMonth.toISOString()),
        ]);

        return NextResponse.json({
            upcoming: (eventsRes.count || 0) + (deadlinesUpcoming.count || 0),
            overdue: deadlinesOverdue.count || 0,
            dueThisWeek: deadlinesThisWeek.count || 0,
            completedThisMonth: deadlinesCompleted.count || 0,
        });
    } catch (err) {
        console.error("[Calendar Stats GET]", err);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
