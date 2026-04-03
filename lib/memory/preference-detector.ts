/**
 * Preference Detector — Implicit User Preference Learning
 *
 * Detects patterns from user behavior and conversations:
 *   1. Jurisdiction mentions (3+ occurrences → stored preference)
 *   2. Formatting preferences from user edits/corrections
 *   3. Tone preferences (formal/informal, concise/detailed)
 *   4. Practice area focus
 *
 * All detected preferences start with confidence: 0.6 and is_pinned: false.
 * Users can confirm (→ confidence: 1.0) or dismiss detected preferences.
 */

import { supabase } from '@/lib/supabase/server'
import { addMemory } from './manager'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface PreferenceSignal {
    type: 'jurisdiction' | 'formatting' | 'tone' | 'practice_area' | 'style'
    value: string
    occurrences: number
    source: 'chat' | 'document' | 'edit'
}

interface DetectedPreference {
    content: string
    preferenceType: string
    confidence: number
    metadata: Record<string, unknown>
}

// ═══════════════════════════════════════════════════
// JURISDICTION DETECTION
// ═══════════════════════════════════════════════════

const JURISDICTION_PATTERNS: Record<string, RegExp> = {
    'New York': /\b(new\s+york|NY|N\.Y\.)\b/gi,
    'Delaware': /\b(delaware|DE|Del\.)\b/gi,
    'California': /\b(california|CA|Cal\.)\b/gi,
    'Texas': /\b(texas|TX|Tex\.)\b/gi,
    'Illinois': /\b(illinois|IL|Ill\.)\b/gi,
    'Florida': /\b(florida|FL|Fla\.)\b/gi,
    'England and Wales': /\b(england\s+and\s+wales|english\s+law|E&W)\b/gi,
    'EU': /\b(european\s+union|EU\s+law|GDPR|EU\s+regulation)\b/gi,
    'Singapore': /\b(singapore|SGP|SG\s+law)\b/gi,
    'Hong Kong': /\b(hong\s+kong|HK|HKSAR)\b/gi,
}

/**
 * Detect jurisdiction preferences from conversation text.
 * Returns jurisdictions mentioned 3+ times.
 */
function detectJurisdictionPreferences(messages: string[]): PreferenceSignal[] {
    const counts: Record<string, number> = {}
    const allText = messages.join(' ')

    for (const [jurisdiction, pattern] of Object.entries(JURISDICTION_PATTERNS)) {
        const matches = allText.match(pattern)
        if (matches) {
            counts[jurisdiction] = (counts[jurisdiction] || 0) + matches.length
        }
    }

    return Object.entries(counts)
        .filter(([, count]) => count >= 3)
        .map(([jurisdiction, count]) => ({
            type: 'jurisdiction' as const,
            value: jurisdiction,
            occurrences: count,
            source: 'chat' as const,
        }))
}

// ═══════════════════════════════════════════════════
// TONE & STYLE DETECTION
// ═══════════════════════════════════════════════════

const TONE_INDICATORS = {
    formal: [
        /\b(pursuant\s+to|hereinafter|whereas|notwithstanding)\b/gi,
        /\b(please\s+provide|kindly\s+note|respectfully)\b/gi,
    ],
    informal: [
        /\b(can\s+you|just|quick|hey|thanks)\b/gi,
        /\b(what's|let's|don't|won't)\b/gi,
    ],
    concise: [
        /\b(brief|summary|short|bullet\s+points|key\s+points)\b/gi,
        /\b(tl;dr|in\s+short|bottom\s+line)\b/gi,
    ],
    detailed: [
        /\b(detailed|comprehensive|thorough|in-depth|elaborate)\b/gi,
        /\b(explain\s+fully|all\s+aspects|complete\s+analysis)\b/gi,
    ],
    numbered: [
        /\b(numbered|numbered\s+list|step\s+by\s+step|steps)\b/gi,
    ],
    british_english: [
        /\b(colour|favour|honour|analyse|organise|defence|licence)\b/gi,
    ],
}

function detectTonePreferences(messages: string[]): PreferenceSignal[] {
    const allText = messages.join(' ')
    const signals: PreferenceSignal[] = []

    for (const [tone, patterns] of Object.entries(TONE_INDICATORS)) {
        let totalMatches = 0
        for (const pattern of patterns) {
            const matches = allText.match(pattern)
            if (matches) totalMatches += matches.length
        }

        if (totalMatches >= 3) {
            signals.push({
                type: 'tone',
                value: tone,
                occurrences: totalMatches,
                source: 'chat',
            })
        }
    }

    return signals
}

// ═══════════════════════════════════════════════════
// PRACTICE AREA DETECTION
// ═══════════════════════════════════════════════════

const PRACTICE_AREA_PATTERNS: Record<string, RegExp> = {
    'M&A / Corporate': /\b(merger|acquisition|due\s+diligence|SPA|share\s+purchase|corporate\s+governance)\b/gi,
    'Employment': /\b(employment|non-compete|non-solicitation|wrongful\s+termination|labor\s+law)\b/gi,
    'IP / Technology': /\b(intellectual\s+property|patent|trademark|copyright|licensing|IP)\b/gi,
    'Real Estate': /\b(real\s+estate|lease|tenancy|landlord|mortgage|conveyancing)\b/gi,
    'Litigation': /\b(litigation|lawsuit|complaint|discovery|trial|arbitration|mediation)\b/gi,
    'Finance / Banking': /\b(loan\s+agreement|security\s+interest|collateral|banking|credit\s+facility)\b/gi,
    'Data Privacy': /\b(GDPR|data\s+protection|privacy\s+policy|data\s+processing|CCPA|DPIA)\b/gi,
    'Tax': /\b(tax\s+law|taxation|tax\s+planning|VAT|withholding|transfer\s+pricing)\b/gi,
}

function detectPracticeAreaPreferences(messages: string[]): PreferenceSignal[] {
    const allText = messages.join(' ')
    const signals: PreferenceSignal[] = []

    for (const [area, pattern] of Object.entries(PRACTICE_AREA_PATTERNS)) {
        const matches = allText.match(pattern)
        if (matches && matches.length >= 3) {
            signals.push({
                type: 'practice_area',
                value: area,
                occurrences: matches.length,
                source: 'chat',
            })
        }
    }

    return signals
}

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

/**
 * Detect all implicit preferences from a set of conversation messages.
 * Returns detected preferences ready for storage.
 */
export function detectPreferences(messages: string[]): DetectedPreference[] {
    if (messages.length < 3) return [] // Need sufficient data

    const results: DetectedPreference[] = []

    // 1. Jurisdiction preferences
    for (const signal of detectJurisdictionPreferences(messages)) {
        results.push({
            content: `Default jurisdiction focus: ${signal.value}`,
            preferenceType: 'jurisdiction',
            confidence: Math.min(0.9, 0.5 + signal.occurrences * 0.05),
            metadata: {
                detected_value: signal.value,
                occurrences: signal.occurrences,
                detection_method: 'pattern_matching',
            },
        })
    }

    // 2. Tone preferences
    for (const signal of detectTonePreferences(messages)) {
        const descriptionMap: Record<string, string> = {
            formal: 'Prefers formal, professional language',
            informal: 'Prefers casual, conversational tone',
            concise: 'Prefers brief, concise responses',
            detailed: 'Prefers detailed, comprehensive responses',
            numbered: 'Prefers numbered paragraphs and structured lists',
            british_english: 'Prefers British English spelling',
        }

        results.push({
            content: descriptionMap[signal.value] || `Prefers ${signal.value} style`,
            preferenceType: 'tone',
            confidence: Math.min(0.85, 0.5 + signal.occurrences * 0.04),
            metadata: {
                detected_value: signal.value,
                occurrences: signal.occurrences,
                detection_method: 'pattern_matching',
            },
        })
    }

    // 3. Practice area preferences
    for (const signal of detectPracticeAreaPreferences(messages)) {
        results.push({
            content: `Primary practice area: ${signal.value}`,
            preferenceType: 'practice_area',
            confidence: Math.min(0.85, 0.5 + signal.occurrences * 0.04),
            metadata: {
                detected_value: signal.value,
                occurrences: signal.occurrences,
                detection_method: 'pattern_matching',
            },
        })
    }

    return results
}

/**
 * Detect preferences and persist them as memory items.
 * Skips duplicates by checking if similar preference already exists.
 */
export async function detectAndPersistPreferences(params: {
    userId: string
    organizationId?: string
    projectId: string
    messages: string[]
}): Promise<number> {
    const detected = detectPreferences(params.messages)
    if (detected.length === 0) return 0

    let persisted = 0

    for (const pref of detected) {
        // Check for existing similar preference
        const { data: existing } = await supabase
            .from('memories')
            .select('id')
            .eq('user_id', params.userId)
            .eq('memory_type', 'preference')
            .eq('is_active', true)
            .ilike('content', `%${pref.metadata.detected_value as string}%`)
            .limit(1)

        if (existing && existing.length > 0) continue

        const result = await addMemory({
            projectId: params.projectId,
            organizationId: params.organizationId,
            userId: params.userId,
            content: pref.content,
            type: 'preference',
            source: 'chat',
            confidence: pref.confidence,
            importance: 2,
            authorityWeight: 0.6,
            metadata: {
                ...pref.metadata,
                preference_type: pref.preferenceType,
                user_confirmed: false,
            },
        })

        if (result && result !== 'duplicate') {
            persisted++
        }
    }

    return persisted
}

/**
 * Confirm a detected preference (user clicks "Confirm ✓").
 * Sets confidence to 1.0 and marks as user-confirmed.
 */
export async function confirmPreference(memoryId: string): Promise<boolean> {
    const { error } = await supabase
        .from('memories')
        .update({
            confidence: 1.0,
            authority_weight: 1.0,
            metadata: { user_confirmed: true, confirmed_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('memory_type', 'preference')

    return !error
}

/**
 * Dismiss a detected preference (user doesn't want it).
 */
export async function dismissPreference(memoryId: string): Promise<boolean> {
    const { error } = await supabase
        .from('memories')
        .update({
            is_active: false,
            metadata: { dismissed: true, dismissed_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('memory_type', 'preference')

    return !error
}
