/**
 * Document Intelligence Module — Public API
 * 
 * Re-exports all document intelligence components for clean imports.
 */

export { analyzeDocument, retrieveProjectAnalysis } from './analyzer'
export { extractClauses, retrieveClauses } from './clauses'
export { extractMetadata } from './metadata'
export type {
    DocumentAnalysis,
    DocumentClause,
    ClauseType,
    AnalysisResult,
    Party,
    Obligation,
    Risk
} from './types'
