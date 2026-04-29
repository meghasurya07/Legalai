import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth'
import { resolveOpenAIClient } from "@/lib/byok";

// POST /api/calendar/extract-dates — AI-powered date extraction from legal text
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const body = await req.json();
        const { text, projectId } = body;

        if (!text || typeof text !== "string" || text.trim().length < 20) {
            return NextResponse.json({ error: "Text must be at least 20 characters" }, { status: 400 });
        }

        // Truncate to 15k chars for cost efficiency
        const truncated = text.slice(0, 15000);

        // Resolve OpenAI client (respects BYOK)
        let orgId: string | undefined;
        try {
            const { getOrgContext } = await import("@/lib/get-org-context");
            const orgCtx = await getOrgContext();
            orgId = orgCtx?.orgId;
        } catch {
            // No org context
        }

        const client = await resolveOpenAIClient(orgId);

        const systemPrompt = `You are a legal document date extraction specialist. Your job is to scan legal documents and extract ALL dates, deadlines, and time-sensitive events.

Return a JSON object with this structure:
{
  "dates": [
    {
      "title": "Brief descriptive title (e.g., 'Motion Response Due', 'Contract Expiration')",
      "date": "YYYY-MM-DD",
      "time": "HH:MM" or null,
      "type": "deadline" or "event",
      "deadlineType": "filing|statute_of_limitations|discovery|motion|response|compliance|custom",
      "priority": "critical|high|medium|low",
      "context": "The exact sentence or paragraph from the document where this date was found (max 200 chars)",
      "confidence": 0.0 to 1.0
    }
  ]
}

**Rules:**
- Extract EVERY date you can find, including:
  - Explicit deadlines ("must file by March 15, 2026")
  - Implicit deadlines ("within 30 days of service" — calculate the date if a reference date is available)
  - Hearing dates, trial dates, deposition dates
  - Contract dates (effective date, expiration, renewal)
  - Statute of limitations
  - Discovery cutoffs
  - Filing deadlines
- For dates in the past, still include them but set priority to "low"
- For relative dates ("within 30 days"), try to compute the actual date from context. If you can't, use the title to describe it and set confidence to 0.5
- Confidence: 1.0 = explicitly stated, 0.8 = clearly implied, 0.5 = calculated/inferred
- Sort by date ascending
- Maximum 25 dates per extraction`;

        const userPrompt = `Extract all dates and deadlines from this legal document:\n\n${truncated}`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            return NextResponse.json({ dates: [], error: "Failed to parse AI response" });
        }

        // Validate and sanitize dates
        const dates = (parsed.dates || [])
            .filter((d: Record<string, unknown>) => d.title && d.date)
            .slice(0, 25)
            .map((d: Record<string, unknown>) => ({
                title: String(d.title).slice(0, 200),
                date: String(d.date),
                time: d.time ? String(d.time) : null,
                type: d.type === "event" ? "event" : "deadline",
                deadlineType: d.deadlineType || "custom",
                priority: ["critical", "high", "medium", "low"].includes(String(d.priority))
                    ? d.priority
                    : "medium",
                context: d.context ? String(d.context).slice(0, 300) : null,
                confidence: typeof d.confidence === "number" ? Math.min(1, Math.max(0, d.confidence)) : 0.7,
                projectId: projectId || null,
            }));

        return NextResponse.json({ dates, documentLength: truncated.length });
    } catch (err) {
        logger.error("Extract Dates", "Request failed", err);
        return NextResponse.json({ error: "Failed to extract dates" }, { status: 500 });
    }
}