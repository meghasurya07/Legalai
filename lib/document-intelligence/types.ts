/**
 * Document Intelligence — Types
 * 
 * Shared TypeScript types for document analysis and clause extraction.
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
    createdAt?: string
}

export interface Party {
    name: string
    role: string
}

export interface Obligation {
    party: string
    obligation: string
    deadline?: string
}

export interface Risk {
    category: string
    description: string
    severity: 'high' | 'medium' | 'low'
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
    createdAt?: string
}

export interface AnalysisResult {
    analysis: DocumentAnalysis
    clauses: DocumentClause[]
    success: boolean
    error?: string
}
