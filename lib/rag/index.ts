/**
 * RAG Module — Public API
 * 
 * Re-exports all RAG components for clean imports.
 */

export { chunkText, type Chunk } from './chunker'
export { embedText, embedChunks, type EmbeddingResult } from './embeddings'
export { ingestFile, deleteFileChunks } from './ingest'
export {
    retrieveRelevantChunks,
    buildRAGContext,
    buildRAGSourcesBlock,
    ensureCitationMarkers,
    RAG_GROUNDING_INSTRUCTION,
    type RetrievedChunk,
    type RetrievalResult
} from './retrieve'

