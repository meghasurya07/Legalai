/**
 * Job Queue — Handlers
 * 
 * Maps job types to their execution functions.
 * Each handler calls into existing pipelines.
 */

import type { JobType } from './types'

type JobHandler = (payload: Record<string, unknown>) => Promise<void>

/**
 * Execute the correct pipeline for a job type.
 */
export async function executeJobHandler(
    jobType: JobType,
    payload: Record<string, unknown>
): Promise<void> {
    const handlers: Record<JobType, JobHandler> = {
        RAG_INGEST: async (p) => {
            const { ingestFile } = await import('@/lib/rag')
            await ingestFile(
                String(p.fileId),
                String(p.projectId),
                String(p.text),
                String(p.fileName || '')
            )
        },

        DOC_ANALYSIS: async (p) => {
            const { analyzeDocument } = await import('@/lib/document-intelligence')
            await analyzeDocument(
                String(p.fileId),
                String(p.projectId),
                String(p.text)
            )
        },

        CLAUSE_EXTRACTION: async (p) => {
            const { extractClauses } = await import('@/lib/document-intelligence/clauses')
            await extractClauses(
                String(p.fileId),
                String(p.projectId),
                String(p.text)
            )
        },

        MEMORY_EXTRACTION: async (p) => {
            const { extractAndPersistMemories } = await import('@/lib/memory')
            await extractAndPersistMemories({
                projectId: String(p.projectId),
                text: String(p.text),
                source: (p.source as 'chat' | 'workflow') || 'chat',
                sourceId: p.sourceId ? String(p.sourceId) : undefined
            })
        },

        GRAPH_BUILD: async (p) => {
            const { extractAndPersistGraph } = await import('@/lib/graph')
            await extractAndPersistGraph({
                projectId: String(p.projectId),
                text: String(p.text),
                source: (p.source as 'doc' | 'workflow' | 'chat') || 'doc',
                refId: p.refId ? String(p.refId) : undefined
            })
        },

        WORKFLOW_RUN: async (p) => {
            const { executeWorkflow } = await import('@/lib/workflow/engine')
            const { PIPELINES } = await import('@/lib/workflow/pipelines')
            const pipeline = PIPELINES[String(p.workflowType)]
            if (pipeline) {
                await executeWorkflow(
                    pipeline,
                    p.inputs as Record<string, unknown>,
                    String(p.projectId),
                    String(p.workflowRunId)
                )
            }
        },

        INSIGHT_GEN: async (p) => {
            const { generateVaultInsights } = await import('@/lib/trust')
            await generateVaultInsights(String(p.projectId))
        },

        PROJECT_SUMMARY: async (p) => {
            const { generateProjectSummary } = await import('@/lib/trust')
            await generateProjectSummary(String(p.projectId))
        },

        CONFLICT_DETECTION: async (p) => {
            const { detectConflicts } = await import('@/lib/trust')
            await detectConflicts(String(p.projectId))
        },

        ARGUMENT_EXTRACTION: async (p) => {
            const { extractArguments, persistArguments } = await import('@/lib/memory/argument-tracker')
            const args = await extractArguments(
                String(p.text),
                String(p.projectId),
                p.organizationId ? String(p.organizationId) : undefined,
                p.conversationId ? String(p.conversationId) : undefined
            )
            await persistArguments(args)
        },

        FIRM_PATTERN_DETECTION: async (p) => {
            const { detectFirmPatterns } = await import('@/lib/memory/firm-intelligence')
            await detectFirmPatterns(String(p.organizationId))
        }
    }

    const handler = handlers[jobType]
    if (!handler) {
        throw new Error(`Unknown job type: ${jobType}`)
    }

    await handler(payload)
}
