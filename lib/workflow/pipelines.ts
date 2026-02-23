/**
 * Workflow Engine — Pipelines
 * 
 * Defines standard workflow pipelines.
 */

import { WorkflowPipeline } from './types'

export const PIPELINES: Record<string, WorkflowPipeline> = {
    contract_analysis: {
        id: 'contract_analysis',
        name: 'Contract Analysis',
        description: 'Multi-step contract review: Clauses -> Risks -> Synthesis',
        steps: [
            {
                id: 'step_1',
                type: 'CLAUSE_ANALYSIS',
                name: 'Clause Extractor',
                promptTemplate: 'Extract key clauses including Term, Termination, Indemnification, and Liability caps.',
                contextSource: 'NONE' // Uses direct input text
            },
            {
                id: 'step_2',
                type: 'RISK_ASSSESSMENT',
                name: 'Risk Classifier',
                promptTemplate: 'Analyze extracted clauses for high-risk terms. Flag missing standard clauses.',
                contextSource: 'CLAUSES' // Uses output from step 1
            },
            {
                id: 'step_3',
                type: 'SYNTHESIS',
                name: 'Executive Summary',
                promptTemplate: 'Generate an executive summary with a strict "Audit Matrix" table.',
                contextSource: 'ALL' // Uses everything
            }
        ]
    }
}
