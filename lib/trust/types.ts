/**
 * Trust & Insight Layer — Core Types
 */

export type ConflictType =
    | 'governing_law'
    | 'jurisdiction'
    | 'termination'
    | 'liability'
    | 'payment'
    | 'obligation'
    | 'other'

export type InsightType =
    | 'risk_alert'
    | 'obligation_gap'
    | 'jurisdiction_mismatch'
    | 'payment_inconsistency'
    | 'termination_risk'
    | 'indemnity_exposure'
    | 'other'

export type Severity = 'high' | 'medium' | 'low'

export interface ProjectConflict {
    id?: string
    project_id: string
    conflict_type: ConflictType
    entity_a: string
    entity_b: string
    description: string
    severity: Severity
    related_file_ids: string[]
    created_at?: string
}

export interface ProjectInsight {
    id?: string
    project_id: string
    insight_type: InsightType
    description: string
    severity: Severity
    related_entity_ids: string[]
    created_at?: string
}

export interface ProjectSummary {
    id?: string
    project_id: string
    summary_text: string
    key_parties: Array<{ name: string; role: string }>
    jurisdiction: string | null
    risks: Array<{ description: string; severity: Severity }>
    obligations: Array<{ party: string; obligation: string }>
    conflicts_count: number
    updated_at?: string
}

export interface GuardrailResult {
    valid: boolean
    warnings: string[]
}
