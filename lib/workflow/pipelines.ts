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
                contextSource: 'NONE'
            },
            {
                id: 'step_2',
                type: 'RISK_ASSESSMENT',
                name: 'Risk Classifier',
                promptTemplate: 'Analyze extracted clauses for high-risk terms. Flag missing standard clauses.',
                contextSource: 'CLAUSES'
            },
            {
                id: 'step_3',
                type: 'SYNTHESIS',
                name: 'Executive Summary',
                promptTemplate: 'Generate an executive summary with a strict "Audit Matrix" table.',
                contextSource: 'ALL'
            }
        ]
    },

    due_diligence: {
        id: 'due_diligence',
        name: 'Due Diligence Review',
        description: 'Comprehensive due diligence: Metadata -> Obligations -> Risks -> Conflicts -> Report',
        steps: [
            {
                id: 'dd_1',
                type: 'METADATA_ANALYSIS',
                name: 'Document Classifier',
                promptTemplate: 'Classify document type, extract parties, dates, and governing jurisdiction.',
                contextSource: 'NONE'
            },
            {
                id: 'dd_2',
                type: 'OBLIGATION_CHECK',
                name: 'Obligation Mapper',
                promptTemplate: 'Map all obligations by party. Identify deadlines, conditions precedent, and performance requirements.',
                contextSource: 'METADATA'
            },
            {
                id: 'dd_3',
                type: 'RISK_ASSESSMENT',
                name: 'Risk Assessment',
                promptTemplate: 'Assess risks: uncapped liability, unlimited indemnity, change of control, regulatory compliance gaps.',
                contextSource: 'ALL'
            },
            {
                id: 'dd_4',
                type: 'SYNTHESIS',
                name: 'Due Diligence Report',
                promptTemplate: 'Generate a structured due diligence report with risk matrix, key findings, and recommended actions.',
                contextSource: 'ALL'
            }
        ]
    },

    compliance_review: {
        id: 'compliance_review',
        name: 'Compliance Review',
        description: 'Regulatory compliance check: Scan -> Requirements -> Gaps -> Remediation',
        steps: [
            {
                id: 'comp_1',
                type: 'COMPLIANCE_SCAN',
                name: 'Regulatory Scanner',
                promptTemplate: 'Identify all regulatory frameworks referenced or applicable (GDPR, SOX, HIPAA, etc.).',
                contextSource: 'NONE'
            },
            {
                id: 'comp_2',
                type: 'OBLIGATION_CHECK',
                name: 'Compliance Requirements',
                promptTemplate: 'Extract specific compliance obligations, reporting requirements, and control requirements.',
                contextSource: 'CLAUSES'
            },
            {
                id: 'comp_3',
                type: 'RISK_ASSESSMENT',
                name: 'Gap Analysis',
                promptTemplate: 'Identify compliance gaps, missing controls, and areas of non-conformance.',
                contextSource: 'ALL'
            },
            {
                id: 'comp_4',
                type: 'SYNTHESIS',
                name: 'Compliance Report',
                promptTemplate: 'Generate compliance report with gap matrix, remediation priorities, and timeline.',
                contextSource: 'ALL'
            }
        ]
    },

    risk_assessment: {
        id: 'risk_assessment',
        name: 'Risk Assessment',
        description: 'Deep risk analysis: Clauses -> Risk Identification -> Risk Scoring -> Mitigation',
        steps: [
            {
                id: 'risk_1',
                type: 'CLAUSE_ANALYSIS',
                name: 'Risk-Focused Clause Analysis',
                promptTemplate: 'Extract clauses with liability, indemnity, warranty, force majeure, termination, and limitation provisions.',
                contextSource: 'NONE'
            },
            {
                id: 'risk_2',
                type: 'RISK_ASSESSMENT',
                name: 'Risk Identification & Scoring',
                promptTemplate: 'Score each risk on likelihood (1-5) and impact (1-5). Calculate risk score as likelihood × impact.',
                contextSource: 'CLAUSES'
            },
            {
                id: 'risk_3',
                type: 'SYNTHESIS',
                name: 'Risk Mitigation Report',
                promptTemplate: 'Generate risk register with heat map, mitigation strategies, and prioritized action items.',
                contextSource: 'ALL'
            }
        ]
    },

    research_memo: {
        id: 'research_memo',
        name: 'Legal Research Memo',
        description: 'Structured legal research: Query -> Research -> Analysis -> IRAC Memo',
        steps: [
            {
                id: 'memo_1',
                type: 'RAG_QUERY',
                name: 'Document Research',
                promptTemplate: 'Search project documents for relevant precedents, clauses, and factual context.',
                contextSource: 'RAG'
            },
            {
                id: 'memo_2',
                type: 'LEGAL_RESEARCH',
                name: 'Legal Analysis',
                promptTemplate: 'Analyze applicable law, precedent, and regulatory guidance. Apply IRAC methodology.',
                contextSource: 'ALL'
            },
            {
                id: 'memo_3',
                type: 'SYNTHESIS',
                name: 'Research Memo',
                promptTemplate: 'Draft formal legal research memo in IRAC format with citations and recommendations.',
                contextSource: 'ALL'
            }
        ]
    },

    drafting_review: {
        id: 'drafting_review',
        name: 'Drafting Review',
        description: 'Document drafting quality check: Structure -> Consistency -> Completeness -> Polish',
        steps: [
            {
                id: 'draft_1',
                type: 'METADATA_ANALYSIS',
                name: 'Structure Analysis',
                promptTemplate: 'Analyze document structure, section organization, and defined terms consistency.',
                contextSource: 'NONE'
            },
            {
                id: 'draft_2',
                type: 'CLAUSE_ANALYSIS',
                name: 'Consistency Check',
                promptTemplate: 'Check for internal contradictions, undefined terms, dangling cross-references, and ambiguous language.',
                contextSource: 'METADATA'
            },
            {
                id: 'draft_3',
                type: 'SYNTHESIS',
                name: 'Drafting Report',
                promptTemplate: 'Generate drafting quality report with specific redline suggestions, issue severity, and recommended improvements.',
                contextSource: 'ALL'
            }
        ]
    }
}
