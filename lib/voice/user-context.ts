import { supabase } from "@/lib/supabase/server"

/**
 * Builds a compact text context from the user's Supabase data.
 * This gets injected into the OpenAI Realtime session as TEXT tokens ($0.30/1M cached).
 * Target: ~1,000–2,000 tokens to keep costs low while providing rich context.
 */
export async function buildUserContext(userId: string, orgId?: string): Promise<string> {
    const today = new Date()
    const todayISO = today.toISOString()
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all context in parallel for speed
    const [calendarResult, chatsResult, memoryResult] = await Promise.allSettled([
        fetchUpcomingEvents(userId, todayISO, weekFromNow),
        fetchRecentChats(userId),
        fetchUserMemories(userId),
    ])

    const calendar = calendarResult.status === "fulfilled" ? calendarResult.value : "No calendar data available."
    const chats = chatsResult.status === "fulfilled" ? chatsResult.value : "No recent chats."
    const memory = memoryResult.status === "fulfilled" ? memoryResult.value : "No stored memories."

    const dateStr = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    })

    return `USER CONTEXT:
Today is ${dateStr} (${todayISO}).
${orgId ? `Organization ID: ${orgId}` : ""}

UPCOMING CALENDAR (next 7 days):
${calendar}

RECENT CONVERSATIONS:
${chats}

USER MEMORY & PREFERENCES:
${memory}`
}

/**
 * Fetch upcoming calendar events for the next 7 days.
 */
async function fetchUpcomingEvents(
    userId: string,
    start: string,
    end: string
): Promise<string> {
    try {
        const { data, error } = await supabase
            .from("calendar_events")
            .select("title, event_type, start_at, end_at, location, court_name, case_number")
            .eq("user_id", userId)
            .gte("start_at", start)
            .lte("start_at", end)
            .order("start_at", { ascending: true })
            .limit(20)

        if (error || !data || data.length === 0) return "No upcoming events."

        return data
            .map((e) => {
                const date = new Date(e.start_at).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                })
                const time = new Date(e.start_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                })
                let line = `- ${date} ${time}: ${e.title} (${e.event_type})`
                if (e.court_name) line += ` at ${e.court_name}`
                if (e.case_number) line += ` [Case: ${e.case_number}]`
                if (e.location) line += ` @ ${e.location}`
                return line
            })
            .join("\n")
    } catch {
        return "Could not load calendar events."
    }
}

/**
 * Fetch recent chat summaries (last 10).
 */
async function fetchRecentChats(userId: string): Promise<string> {
    try {
        const { data, error } = await supabase
            .from("recent_chats")
            .select("title, type, preview, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10)

        if (error || !data || data.length === 0) return "No recent conversations."

        return data
            .map((c) => {
                const date = new Date(c.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                })
                const preview = c.preview
                    ? c.preview.substring(0, 100) + (c.preview.length > 100 ? "..." : "")
                    : ""
                return `- ${date}: [${c.type}] ${c.title}${preview ? " — " + preview : ""}`
            })
            .join("\n")
    } catch {
        return "Could not load recent chats."
    }
}

/**
 * Fetch user memories/preferences (last 15, active only).
 */
async function fetchUserMemories(userId: string): Promise<string> {
    try {
        const { data, error } = await supabase
            .from("memories")
            .select("content, memory_type, importance")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("importance", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(15)

        if (error || !data || data.length === 0) return "No stored preferences or memories."

        return data
            .map((m) => `- [${m.memory_type}] ${m.content}`)
            .join("\n")
    } catch {
        return "Could not load memories."
    }
}
