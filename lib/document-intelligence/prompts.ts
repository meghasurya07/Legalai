/**
 * Document Intelligence — AI Prompt Templates
 * 
 * Structured prompts for document summary, metadata extraction, and clause detection.
 * All prompts enforce strict JSON output for reliable parsing.
 * 
 * Text windowing is handled by the caller (analyzer.ts) — prompts receive
 * appropriately-sized text segments, NOT the full document.
 */

/**
 * Build prompt for generating a concise legal document summary.
 * @param text - Text segment to summarize (may be a window of a larger document)
 * @param windowInfo - Optional info about which window this is (e.g., "Window 2 of 5")
 */
export function buildSummaryPrompt(
    text: string,
    windowInfo?: string
): { systemPrompt: string; userPrompt: string } {
    const windowCtx = windowInfo
        ? `\nNote: This is ${windowInfo} of the document. Focus on extracting the most important legal information from this section.`
        : ''

    return {
        systemPrompt: `You are a senior legal analyst. Analyze the provided document text and return a JSON object with a single key:

{
  "summary": "A concise 3-5 sentence legal summary covering: document type, purpose, key parties, main provisions, and significant terms or conditions."
}

Rules:
- Be precise and use professional legal language
- Focus on legally significant content
- Do NOT include boilerplate observations
- Return ONLY valid JSON, no markdown${windowCtx}`,
        userPrompt: `Summarize this legal document:\n\n${text}`
    }
}

/**
 * Build prompt for extracting structured metadata from a legal document.
 * @param text - Text segment to extract from (may be a window of a larger document)
 * @param windowInfo - Optional info about which window this is
 */
export function buildMetadataPrompt(
    text: string,
    windowInfo?: string
): { systemPrompt: string; userPrompt: string } {
    const windowCtx = windowInfo
        ? `\nNote: This is ${windowInfo} of the document. Extract whatever metadata is present in this section. Some fields may not appear in every section — use null for missing fields.`
        : ''

    return {
        systemPrompt: `You are a legal metadata extraction specialist. Extract structured metadata from the document and return ONLY valid JSON:

{
  "parties": [{"name": "Party Name", "role": "Role description", "confidence": 0.9}],
  "effective_date": "YYYY-MM-DD or null if not found",
  "governing_law": "Jurisdiction/governing law or null",
  "termination_clause": "Brief description of termination provisions or null",
  "key_obligations": [{"party": "Party Name", "obligation": "Description", "deadline": "Date or null", "confidence": 0.9}],
  "risks": [{"category": "Category", "description": "Description", "severity": "high|medium|low", "confidence": 0.8}]
}

Rules:
- Extract ONLY information explicitly stated in the document
- Use null for fields not found in the document
- Return empty arrays [] if no items found for array fields
- Dates must be in YYYY-MM-DD format
- severity must be exactly "high", "medium", or "low"
- confidence: 0.0-1.0 indicating how certain you are about the extraction (1.0 = verbatim from text, 0.5 = inferred)
- Return ONLY valid JSON, no markdown${windowCtx}`,
        userPrompt: `Extract metadata from this legal document:\n\n${text}`
    }
}

/**
 * Build prompt for detecting and classifying legal clauses.
 * @param text - Text segment to analyze (may be a window of a larger document)
 * @param windowInfo - Optional info about which window this is
 */
export function buildClausePrompt(
    text: string,
    windowInfo?: string
): { systemPrompt: string; userPrompt: string } {
    const windowCtx = windowInfo
        ? `\nNote: This is ${windowInfo} of the document. Extract clauses found in this section only.`
        : ''

    return {
        systemPrompt: `You are a legal clause detection specialist. Identify and classify legal clauses in the document. Return ONLY a valid JSON object:

{
  "clauses": [
    {
      "clause_type": "one of: termination|indemnity|confidentiality|liability|jurisdiction|payment|intellectual_property|dispute_resolution|force_majeure|non_compete|warranty|other",
      "section_title": "Section heading if identifiable, or null",
      "section_number": "Section number (e.g., '12.2') if identifiable, or null",
      "text": "The relevant clause text, condensed to key provisions (max 500 chars)",
      "confidence": 0.9
    }
  ]
}

Rules:
- Identify all distinct clauses matching the supported types
- Each clause should appear only once (no duplicates)
- Condense lengthy clauses to their key legal effect
- section_title and section_number can be null if not clearly identifiable
- clause_type must be exactly one of the listed values
- confidence: 0.0-1.0 indicating certainty of classification (1.0 = explicit clause header, 0.5 = inferred from context)
- Return ONLY valid JSON, no markdown
- If no clauses are found, return {"clauses": []}${windowCtx}`,
        userPrompt: `Detect and classify legal clauses in this document:\n\n${text}`
    }
}

/**
 * Build prompt for merging multiple partial summaries into one cohesive summary.
 */
export function buildMergeSummaryPrompt(
    partialSummaries: string[]
): { systemPrompt: string; userPrompt: string } {
    return {
        systemPrompt: `You are a senior legal analyst. You will receive multiple partial summaries from different sections of the same legal document. Synthesize them into a single coherent summary.

Return a JSON object:
{
  "summary": "A concise 3-7 sentence legal summary covering: document type, purpose, key parties, main provisions, and significant terms or conditions."
}

Rules:
- Merge overlapping information, do not repeat
- Maintain chronological and logical flow
- Use professional legal language
- Return ONLY valid JSON, no markdown`,
        userPrompt: `Merge these partial document summaries into one cohesive summary:\n\n${partialSummaries.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n')}`
    }
}
