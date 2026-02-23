/**
 * Document Intelligence — AI Prompt Templates
 * 
 * Structured prompts for document summary, metadata extraction, and clause detection.
 * All prompts enforce strict JSON output for reliable parsing.
 */

import { truncateText } from '@/lib/ai/client'

/**
 * Build prompt for generating a concise legal document summary.
 */
export function buildSummaryPrompt(text: string): { systemPrompt: string; userPrompt: string } {
    return {
        systemPrompt: `You are a senior legal analyst. Analyze the provided document and return a JSON object with a single key:

{
  "summary": "A concise 3-5 sentence legal summary covering: document type, purpose, key parties, main provisions, and significant terms or conditions."
}

Rules:
- Be precise and use professional legal language
- Focus on legally significant content
- Do NOT include boilerplate observations
- Return ONLY valid JSON, no markdown`,
        userPrompt: `Summarize this legal document:\n\n${truncateText(text, 6000)}`
    }
}

/**
 * Build prompt for extracting structured metadata from a legal document.
 */
export function buildMetadataPrompt(text: string): { systemPrompt: string; userPrompt: string } {
    return {
        systemPrompt: `You are a legal metadata extraction specialist. Extract structured metadata from the document and return ONLY valid JSON:

{
  "parties": [{"name": "Party Name", "role": "Role description"}],
  "effective_date": "YYYY-MM-DD or null if not found",
  "governing_law": "Jurisdiction/governing law or null",
  "termination_clause": "Brief description of termination provisions or null",
  "key_obligations": [{"party": "Party Name", "obligation": "Description", "deadline": "Date or null"}],
  "risks": [{"category": "Category", "description": "Description", "severity": "high|medium|low"}]
}

Rules:
- Extract ONLY information explicitly stated in the document
- Use null for fields not found in the document
- Return empty arrays [] if no items found for array fields
- Dates must be in YYYY-MM-DD format
- severity must be exactly "high", "medium", or "low"
- Return ONLY valid JSON, no markdown`,
        userPrompt: `Extract metadata from this legal document:\n\n${truncateText(text, 6000)}`
    }
}

/**
 * Build prompt for detecting and classifying legal clauses.
 */
export function buildClausePrompt(text: string): { systemPrompt: string; userPrompt: string } {
    return {
        systemPrompt: `You are a legal clause detection specialist. Identify and classify legal clauses in the document. Return ONLY a valid JSON object:

{
  "clauses": [
    {
      "clause_type": "one of: termination|indemnity|confidentiality|liability|jurisdiction|payment|intellectual_property|dispute_resolution|force_majeure|non_compete|warranty|other",
      "section_title": "Section heading if identifiable, or null",
      "section_number": "Section number (e.g., '12.2') if identifiable, or null",
      "text": "The relevant clause text, condensed to key provisions (max 500 chars)"
    }
  ]
}

Rules:
- Identify all distinct clauses matching the supported types
- Each clause should appear only once (no duplicates)
- Condense lengthy clauses to their key legal effect
- section_title and section_number can be null if not clearly identifiable
- clause_type must be exactly one of the listed values
- Return ONLY valid JSON, no markdown
- If no clauses are found, return {"clauses": []}`,
        userPrompt: `Detect and classify legal clauses in this document:\n\n${truncateText(text, 6000)}`
    }
}
