/**
 * Document Intelligence — Types
 * 
 * Shared TypeScript types for document analysis and clause extraction.
 * M12: Added confidence scores on extracted fields.
 */

// Supported clause types for legal document analysis
export type ClauseType =
    | 'termination'
    | 'indemnity'
    | 'confidentiality'
    | 'liability'
    | 'jurisdiction'
    | 'payment'
    | 'intellectual_property'
    | 'dispute_resolution'
    | 'force_majeure'
    | 'non_compete'
    | 'warranty'
    | 'other'

export interface DocumentAnalysis {
    id?: string
    fileId: string
    projectId: string
    summary: string
    parties: Party[]
    effectiveDate: string | null
    terminationClause: string | null
    governingLaw: string | null
    keyObligations: Obligation[]
    risks: Risk[]
    /** M12: Overall analysis confidence (0.0-1.0) */
    confidence?: number
    createdAt?: string
}

export interface Party {
    name: string
    role: string
    /** M12: Confidence in party identification (0.0-1.0) */
    confidence?: number
}

export interface Obligation {
    party: string
    obligation: string
    deadline?: string
    /** M12: Confidence in obligation extraction (0.0-1.0) */
    confidence?: number
}

export interface Risk {
    category: string
    description: string
    severity: 'high' | 'medium' | 'low'
    /** M12: Confidence in risk assessment (0.0-1.0) */
    confidence?: number
}

export interface DocumentClause {
    id?: string
    fileId: string
    projectId: string
    clauseType: ClauseType
    sectionTitle: string | null
    sectionNumber: string | null
    content: string
    chunkRef: string | null
    /** M12: Confidence in clause classification (0.0-1.0) */
    confidence?: number
    createdAt?: string
}

export interface AnalysisResult {
    analysis: DocumentAnalysis
    clauses: DocumentClause[]
    success: boolean
    error?: string
}
