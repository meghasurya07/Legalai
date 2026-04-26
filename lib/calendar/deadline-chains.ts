/**
 * Smart Deadline Chains — Legal deadline cascade definitions.
 *
 * When a lawyer creates a deadline of a certain type (e.g., "Motion Filed"),
 * Wesley auto-suggests the chain of related deadlines that typically follow.
 *
 * Offsets are based on common U.S. Federal Rules of Civil Procedure.
 * Always marked as approximate — users must verify with local rules.
 */

import type { DeadlineType, DeadlinePriority } from "@/types"

export interface ChainItem {
    offsetDays: number
    title: string
    deadlineType: DeadlineType
    priority: DeadlinePriority
    description: string
}

export interface DeadlineChain {
    triggerId: string
    label: string
    description: string
    jurisdiction: string
    items: ChainItem[]
}

export const DEADLINE_CHAINS: DeadlineChain[] = [
    {
        triggerId: "motion_filed",
        label: "Motion Filed",
        description: "Standard motion briefing schedule under Federal Rules",
        jurisdiction: "U.S. Federal (approx.)",
        items: [
            {
                offsetDays: 21,
                title: "Opposition / Response brief due",
                deadlineType: "response",
                priority: "high",
                description: "FRCP Rule 6(d) — 21 days to file opposition",
            },
            {
                offsetDays: 28,
                title: "Reply brief due",
                deadlineType: "response",
                priority: "high",
                description: "7 days after opposition (14 days in some courts)",
            },
            {
                offsetDays: 35,
                title: "Hearing date (earliest)",
                deadlineType: "motion",
                priority: "critical",
                description: "Typical earliest hearing date after full briefing",
            },
        ],
    },
    {
        triggerId: "complaint_filed",
        label: "Complaint / Petition Filed",
        description: "Response timeline after initiating a lawsuit",
        jurisdiction: "U.S. Federal (approx.)",
        items: [
            {
                offsetDays: 21,
                title: "Answer or Rule 12 Motion due",
                deadlineType: "response",
                priority: "critical",
                description: "FRCP Rule 12(a)(1) — 21 days after service",
            },
            {
                offsetDays: 14,
                title: "Rule 26(f) Conference",
                deadlineType: "discovery",
                priority: "high",
                description: "Parties must meet to plan discovery",
            },
            {
                offsetDays: 100,
                title: "Initial disclosures due",
                deadlineType: "discovery",
                priority: "high",
                description: "FRCP Rule 26(a)(1) — within 14 days after Rule 26(f)",
            },
        ],
    },
    {
        triggerId: "discovery_served",
        label: "Discovery Requests Served",
        description: "Deadlines after receiving interrogatories/document requests",
        jurisdiction: "U.S. Federal (approx.)",
        items: [
            {
                offsetDays: 30,
                title: "Discovery responses due",
                deadlineType: "response",
                priority: "high",
                description: "FRCP Rule 33/34 — 30 days to respond",
            },
            {
                offsetDays: 25,
                title: "Begin preparing response",
                deadlineType: "custom",
                priority: "medium",
                description: "Internal reminder — start gathering documents",
            },
            {
                offsetDays: 37,
                title: "Motion to compel deadline",
                deadlineType: "motion",
                priority: "medium",
                description: "Meet and confer + motion if responses inadequate",
            },
        ],
    },
    {
        triggerId: "appeal_filed",
        label: "Notice of Appeal Filed",
        description: "Appellate briefing schedule",
        jurisdiction: "U.S. Federal (approx.)",
        items: [
            {
                offsetDays: 40,
                title: "Opening brief due",
                deadlineType: "filing",
                priority: "critical",
                description: "FRAP Rule 31(a) — typically 40 days",
            },
            {
                offsetDays: 70,
                title: "Answering brief due",
                deadlineType: "response",
                priority: "high",
                description: "30 days after opening brief",
            },
            {
                offsetDays: 84,
                title: "Reply brief due",
                deadlineType: "response",
                priority: "high",
                description: "14 days after answering brief",
            },
        ],
    },
    {
        triggerId: "statute_deadline",
        label: "Statute of Limitations Approaching",
        description: "Pre-filing preparation timeline",
        jurisdiction: "General",
        items: [
            {
                offsetDays: -90,
                title: "Begin drafting complaint",
                deadlineType: "custom",
                priority: "high",
                description: "Allow 90 days for investigation and drafting",
            },
            {
                offsetDays: -30,
                title: "Final review and client approval",
                deadlineType: "compliance",
                priority: "critical",
                description: "Obtain client sign-off on complaint",
            },
            {
                offsetDays: -7,
                title: "File complaint",
                deadlineType: "filing",
                priority: "critical",
                description: "File with buffer before statute expires",
            },
        ],
    },
    {
        triggerId: "trial_date",
        label: "Trial Date Set",
        description: "Pre-trial preparation deadlines",
        jurisdiction: "General",
        items: [
            {
                offsetDays: -60,
                title: "Expert discovery cutoff",
                deadlineType: "discovery",
                priority: "high",
                description: "Typical expert deposition deadline",
            },
            {
                offsetDays: -30,
                title: "Motions in limine due",
                deadlineType: "motion",
                priority: "high",
                description: "File pre-trial evidentiary motions",
            },
            {
                offsetDays: -14,
                title: "Pre-trial conference",
                deadlineType: "compliance",
                priority: "critical",
                description: "Meet with court for final trial preparation",
            },
            {
                offsetDays: -7,
                title: "Trial brief and exhibit list due",
                deadlineType: "filing",
                priority: "critical",
                description: "Submit trial materials to court",
            },
        ],
    },
]

/**
 * Get chains that match a given deadline type.
 * Maps user-selected deadline types to chain triggers.
 */
export function getChainsForType(deadlineType: DeadlineType): DeadlineChain[] {
    const TYPE_TO_CHAIN: Record<string, string[]> = {
        motion: ["motion_filed"],
        filing: ["complaint_filed", "appeal_filed"],
        discovery: ["discovery_served"],
        statute_of_limitations: ["statute_deadline"],
        response: [], // responses don't trigger chains
        compliance: [],
        custom: [],
    }

    const chainIds = TYPE_TO_CHAIN[deadlineType] || []
    return DEADLINE_CHAINS.filter(c => chainIds.includes(c.triggerId))
}

/**
 * Compute actual dates from a chain, given a base date.
 * Positive offsets = days AFTER the base date.
 * Negative offsets = days BEFORE the base date.
 */
export function computeChainDates(
    chain: DeadlineChain,
    baseDate: Date
): Array<ChainItem & { computedDate: Date }> {
    return chain.items.map(item => {
        const computed = new Date(baseDate)
        computed.setDate(computed.getDate() + item.offsetDays)
        return { ...item, computedDate: computed }
    })
}
