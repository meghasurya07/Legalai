/**
 * Firm Intelligence Engine — Cross-case aggregation and pattern detection
 *
 * Phase 5 of the Wesley Memory Layer.
 * Aggregates knowledge across projects within an organization to surface:
 *   1. Recurring clause patterns and their outcomes
 *   2. Argument success rates by practice area / jurisdiction
 *   3. Common risk patterns and how they were mitigated
 *   4. Best practices that emerge from collective experience
 *
 * Access model: Hybrid
 *   - Lawyers see safe patterns (anonymized, no case-specific details)
 *   - Admins see full insights with source attribution
 */

import { supabase } from '@/lib/supabase/server'
import type { FirmPatternItem, FirmPatternType } from './types'
import { getArgumentPatterns } from './argument-tracker'

// ─── Types ───────────────────────────────────────────────

export interface FirmDashboard {
    totalMemories: number
    totalArguments: number
    totalProjects: number
    topPatterns: FirmPatternItem[]
    argumentStats: {
        total: number
        accepted: number
        rejected: number
        success_rate: number
    }
    riskDistribution: Record<string, number>
    practiceAreas: string[]
}

// ─── Helpers ─────────────────────────────────────────────

function buildPatternItem(
    id: string,
    orgId: string,
    patternType: FirmPatternType,
    title: string,
    description: string,
    confidence: number,
    evidenceCount: number,
    sourceProjectIds: string[] = []
): FirmPatternItem {
    const now = new Date().toISOString()
    return {
        id,
        organization_id: orgId,
        pattern_type: patternType,
        title,
        description,
        confidence,
        evidence_count: evidenceCount,
        source_project_ids: sourceProjectIds,
        access_level: 'all',
        metadata: {},
        created_at: now,
        updated_at: now,
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Pattern Detection ───────────────────────────────────

/**
 * Detect recurring patterns across all projects in an organization.
 * Called periodically (e.g., nightly batch) or on-demand.
 */
export async function detectFirmPatterns(
    organizationId: string
): Promise<FirmPatternItem[]> {
    const patterns: FirmPatternItem[] = []

    try {
        // 1. Clause patterns — find recurring clause types across projects
        const { data: clauseData } = await supabase
            .from('clause_patterns')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('occurrence_count', 3)
            .order('occurrence_count', { ascending: false })
            .limit(10)

        if (clauseData) {
            for (const clause of clauseData) {
                const projectIds = Array.isArray(clause.source_project_ids) ? clause.source_project_ids : []
                patterns.push(buildPatternItem(
                    clause.id,
                    organizationId,
                    'clause_standard',
                    clause.clause_type || 'Clause Pattern',
                    clause.typical_language || clause.description || '',
                    clause.confidence || 0.7,
                    clause.occurrence_count || 0,
                    projectIds
                ))
            }
        }

        // 2. Risk patterns — aggregate risk memories across projects
        const { data: riskMemories } = await supabase
            .from('memories')
            .select('content, project_id, importance')
            .eq('organization_id', organizationId)
            .eq('memory_type', 'risk')
            .eq('is_active', true)
            .gte('importance', 3)
            .order('reinforcement_count', { ascending: false })
            .limit(20)

        if (riskMemories && riskMemories.length >= 3) {
            const riskGroups = groupBySimilarity(
                riskMemories.map(r => ({ text: r.content, projectId: r.project_id }))
            )

            for (const group of riskGroups) {
                if (group.items.length >= 2) {
                    const projectIds = [...new Set(group.items.map(i => i.projectId))]
                    patterns.push(buildPatternItem(
                        `risk-pattern-${group.key}`,
                        organizationId,
                        'risk_distribution',
                        `Recurring Risk: ${group.label}`,
                        group.items[0].text,
                        Math.min(0.95, 0.5 + group.items.length * 0.1),
                        group.items.length,
                        projectIds
                    ))
                }
            }
        }

        // 3. Argument patterns
        const argStats = await getArgumentPatterns(organizationId)
        if (argStats.total >= 5) {
            for (const pattern of argStats.patterns.slice(0, 3)) {
                if (pattern.count >= 2) {
                    patterns.push(buildPatternItem(
                        `arg-pattern-${pattern.argument_type}`,
                        organizationId,
                        'argument_success_rate',
                        `${capitalize(pattern.argument_type)} Arguments`,
                        `${pattern.count} arguments tracked, ${(pattern.success_rate * 100).toFixed(0)}% success rate`,
                        Math.min(0.9, pattern.success_rate),
                        pattern.count
                    ))
                }
            }
        }

        // 4. Save detected patterns to firm_patterns table
        if (patterns.length > 0) {
            await saveFirmPatterns(organizationId, patterns)
        }

    } catch (err) {
        console.warn('[FirmIntelligence] Pattern detection failed:', err)
    }

    return patterns
}

/**
 * Retrieve firm intelligence for a specific query.
 * Used during memory retrieval to inject firm-level context.
 */
export async function getFirmPatterns(
    organizationId: string,
    options?: {
        practiceArea?: string
        limit?: number
        isAdmin?: boolean
    }
): Promise<FirmPatternItem[]> {
    try {
        let query = supabase
            .from('firm_patterns')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('confidence', { ascending: false })
            .limit(options?.limit || 5)

        if (options?.practiceArea) {
            query = query.eq('practice_area', options.practiceArea)
        }

        // Non-admins only see anonymized patterns
        if (!options?.isAdmin) {
            query = query.eq('is_anonymized', true)
        }

        const { data } = await query

        if (!data) return []

        return data.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            organization_id: row.organization_id as string | null,
            pattern_type: (row.pattern_type as FirmPatternType) || 'best_practice',
            title: row.title as string,
            description: row.description as string,
            confidence: row.confidence as number,
            evidence_count: (row.evidence_count as number) || 0,
            source_project_ids: (row.source_project_ids as string[]) || [],
            access_level: (row.access_level as 'admin' | 'lawyer' | 'all') || 'all',
            metadata: (row.metadata as Record<string, unknown>) || {},
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
        }))
    } catch (err) {
        console.warn('[FirmIntelligence] getFirmPatterns failed:', err)
        return []
    }
}

/**
 * Get firm dashboard data for admin view.
 */
export async function getFirmDashboard(
    organizationId: string
): Promise<FirmDashboard> {
    try {
        const { count: totalMemories } = await supabase
            .from('memories')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('is_active', true)

        const { count: totalArguments } = await supabase
            .from('arguments')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)

        const { data: projectData } = await supabase
            .from('memories')
            .select('project_id')
            .eq('organization_id', organizationId)
            .eq('is_active', true)

        const uniqueProjects = new Set(projectData?.map(r => r.project_id) || [])

        const topPatterns = await getFirmPatterns(organizationId, { limit: 5, isAdmin: true })
        const argStats = await getArgumentPatterns(organizationId)

        const { data: riskData } = await supabase
            .from('memories')
            .select('metadata')
            .eq('organization_id', organizationId)
            .eq('memory_type', 'risk')
            .eq('is_active', true)

        const riskDistribution: Record<string, number> = {}
        for (const row of riskData || []) {
            const area = (row.metadata as Record<string, unknown>)?.practice_area as string || 'Uncategorized'
            riskDistribution[area] = (riskDistribution[area] || 0) + 1
        }

        const { data: areaData } = await supabase
            .from('arguments')
            .select('practice_area')
            .eq('organization_id', organizationId)
            .not('practice_area', 'is', null)

        const practiceAreas = [...new Set(areaData?.map(r => r.practice_area).filter(Boolean) || [])] as string[]

        return {
            totalMemories: totalMemories || 0,
            totalArguments: totalArguments || 0,
            totalProjects: uniqueProjects.size,
            topPatterns,
            argumentStats: {
                total: argStats.total,
                accepted: argStats.accepted,
                rejected: argStats.rejected,
                success_rate: argStats.success_rate,
            },
            riskDistribution,
            practiceAreas,
        }
    } catch (err) {
        console.warn('[FirmIntelligence] Dashboard failed:', err)
        return {
            totalMemories: 0,
            totalArguments: 0,
            totalProjects: 0,
            topPatterns: [],
            argumentStats: { total: 0, accepted: 0, rejected: 0, success_rate: 0 },
            riskDistribution: {},
            practiceAreas: [],
        }
    }
}

// ─── Internal Helpers ────────────────────────────────────

async function saveFirmPatterns(
    organizationId: string,
    patterns: FirmPatternItem[]
): Promise<void> {
    for (const pattern of patterns) {
        try {
            await supabase.from('firm_patterns').upsert({
                id: pattern.id,
                organization_id: organizationId,
                pattern_type: pattern.pattern_type,
                title: pattern.title,
                description: pattern.description,
                confidence: pattern.confidence,
                evidence_count: pattern.evidence_count,
                source_project_ids: pattern.source_project_ids,
                access_level: pattern.access_level,
                is_anonymized: true,
                is_active: true,
                metadata: pattern.metadata,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })
        } catch {
            // Continue on individual failure
        }
    }
}

interface SimilarityGroup {
    key: string
    label: string
    items: Array<{ text: string; projectId: string }>
}

function groupBySimilarity(
    items: Array<{ text: string; projectId: string }>
): SimilarityGroup[] {
    const groups: Map<string, SimilarityGroup> = new Map()

    const keywords = [
        'indemnity', 'limitation of liability', 'force majeure', 'termination',
        'confidentiality', 'intellectual property', 'non-compete', 'warranty',
        'governing law', 'jurisdiction', 'arbitration', 'data protection',
        'compliance', 'anti-bribery', 'insurance', 'assignment',
    ]

    for (const item of items) {
        const lower = item.text.toLowerCase()
        let matched = false

        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                if (!groups.has(keyword)) {
                    groups.set(keyword, {
                        key: keyword.replace(/\s+/g, '-'),
                        label: capitalize(keyword),
                        items: [],
                    })
                }
                groups.get(keyword)!.items.push(item)
                matched = true
                break
            }
        }

        if (!matched) {
            const words = lower.split(/\s+/).slice(0, 3).join(' ')
            if (!groups.has(words)) {
                groups.set(words, { key: words.replace(/\s+/g, '-'), label: capitalize(words), items: [] })
            }
            groups.get(words)!.items.push(item)
        }
    }

    return Array.from(groups.values())
        .filter(g => g.items.length >= 2)
        .sort((a, b) => b.items.length - a.items.length)
}
