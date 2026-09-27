# From Stateless to Stateful: Adding Hindsight to a Production Legal AI

When we built Wesley, our Next.js-based legal research assistant, we solved a lot of hard problems early on: massive document ingestion, precision RAG for complex case law, and streaming response pipelines. But as adoption grew, a glaring limitation became obvious: Wesley was effectively an amnesiac.

Every time a user started a new conversation, Wesley forgot everything. If a lawyer corrected Wesley on Monday to prefer Delaware precedents, they had to correct him again on Tuesday. Legal research is inherently cumulative—you build a mental model of a case over weeks or months. A stateless AI, no matter how powerful the foundation model, just doesn't map to how lawyers work.

We needed [agent memory](https://vectorize.io/what-is-agent-memory). We didn't just need vector search over past chats; we needed an architecture that could extract facts, recognize patterns, and recall context dynamically. After evaluating several approaches, we integrated [Hindsight](https://github.com/vectorize-io/hindsight) (by Vectorize) into our production Next.js pipeline. 

Here is a technical deep-dive into how we wired Hindsight into a live streaming chat application, the multi-bank memory architecture we designed, and the patterns we used to keep chat latency practically zero.

![Wesley's home interface — a legal AI assistant built on Next.js](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/wesley-home.png)
*Wesley's clean interface belies the complex memory architecture running underneath.*

## The Problem: Stateless AI Can’t Learn

In a standard LLM chat pipeline, context is strictly bounded by the context window of the current conversation. Once that window closes or you start a new thread, the slate is wiped clean. 

For a legal AI, this is particularly painful. If a user is investigating a complex corporate merger over several days, they shouldn't have to re-explain the entities involved, the jurisdiction, or their strategic angle in every new chat. We realized that true AI utility in the legal space requires building on past work. The system must learn user preferences (e.g., "always cite the bluebook format") and project specifics (e.g., "we represent the plaintiff in Smith v. Jones").

## Architecture Overview: Retain, Recall, Reflect

Hindsight relies on three core primitives, which we mapped directly into Wesley's chat pipeline:

1. **Retain**: Saving new information. In our case, every time Wesley answers a question, we asynchronously toss the user's query and the assistant's response over the wall to Hindsight.
2. **Recall**: Fetching relevant memories. When a user asks a new question, we query Hindsight to pull in established facts, learned preferences, and past context before generating the prompt.
3. **Reflect**: Background consolidation. Hindsight continuously processes retained logs, extracting entities, facts, and patterns, deduplicating them into a unified knowledge graph.

Our goal was to embed these primitives seamlessly. The AI should just *know* things, without the user explicitly managing a knowledge base.

![Architecture diagram showing how Hindsight integrates into Wesley's Next.js chat pipeline](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/architecture-diagram.jpg)
*How Hindsight sits in Wesley's stack: RECALL during context building, RETAIN after response, REFLECT for the Memory Panel UI.*

## The Multi-Bank Strategy: Per-User and Per-Project

Memory isn't monolithic. Some memories are tied to how a specific user works, while others belong to a specific case (which multiple lawyers might collaborate on). Hindsight supports logical partitions called "banks." We adopted a multi-bank strategy to keep context properly isolated.

In `lib/hindsight/client.ts`, we defined our bank ID generation:

```typescript
/**
 * Generate a per-user Hindsight bank ID.
 * Stores personal preferences, jurisdiction habits, frequently referenced cases.
 */
export function getUserBankId(userId: string): string {
  // Sanitize Auth0 IDs
  const sanitized = userId.replace(/[|:]/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '')
  return `wesley-user-${sanitized}`
}

/**
 * Generate a per-project (vault) Hindsight bank ID.
 * Stores project-specific legal context, party names, case strategy.
 */
export function getProjectBankId(projectId: string): string {
  return `wesley-project-${projectId}`
}
```

By splitting banks this way, we query the `userBank` for personal preferences, and the `projectBank` for case facts. This ensures that cross-pollination of sensitive case details doesn't happen, while a user's preference for concise summaries follows them everywhere.

## Bank Dispositions: Tuning for Legal Rigor

Memory systems can sometimes hallucinate or be too eager to trust user input. In the legal domain, accuracy is non-negotiable. Hindsight allows tuning the "disposition" of a bank—controlling how skeptical or literal the extraction engine should be.

We explicitly configured our banks for high skepticism and literalism in `lib/hindsight/config.ts`:

```typescript
export async function configureLegalBank(bankId: string): Promise<void> {
  const client = getHindsightClient()
  try {
    await client.updateBankConfig(bankId, {
      reflectMission: 'Wesley is a legal research AI assistant that helps lawyers... builds deep expertise about each user\'s practice areas, jurisdiction preferences...',
      dispositionSkepticism: 4,   // High — verify legal claims rigorously
      dispositionLiteralism: 4,   // High — precise citations and exact legal language
      dispositionEmpathy: 3,      // Moderate — professional and supportive
      enableObservations: true,   // Auto-consolidate learned patterns
      enableAutoConsolidation: true,
      enableGraphRetrieval: true, // Enable entity graph for legal concept connections
      enableTemporalRetrieval: true, // Enable date-aware retrieval for case law timelines
    })
  } catch (err) {
    logger.warn('hindsight/config', `Bank config failed for ${bankId} (may already exist)`, err)
  }
}
```

This configuration tells Hindsight's background workers exactly how to treat incoming conversation logs. When the user asserts a fact, Hindsight will index it with appropriate skepticism, ensuring we don't accidentally treat a hypothetical legal argument as an established fact.

## The Integration: Wiring it into the Chat Pipeline

Adding memory to a production system involves three main touchpoints: Recalling memories before generation, retaining them after generation, and injecting them into the system prompt.

### 1. Recall (Context Builder)

Before sending the user's message to the LLM, we intercept it to pull relevant context. In our `lib/ai/context-builder.ts`, we added a block to recall memories from both the user and project banks:

```typescript
    // 2.5 Hindsight Long-Term Memory Recall
    try {
        // Ensure bank is configured with legal AI disposition on first use
        ensureBankConfigured(userId, projectId).catch(() => {})

        const hindsightResult = await recallHindsightMemories({
            query: message || '',
            userId,
            projectId,
        })
        if (hindsightResult.count > 0) {
            hindsightContextText = hindsightResult.contextText
            hindsightMemoryCount = hindsightResult.count
        }
    } catch (hindsightError) {
        logger.warn('context-builder', 'Hindsight recall failed (non-blocking)', hindsightError)
    }
```

The `recallHindsightMemories` function queries both banks, deduplicates the results, and formats them into a structured context text (categorizing them into Facts, Experiences, and Observations). By setting `budget: 'low'` in the Hindsight client, we ensured this fetch stays blazing fast so as not to stall the initial chat response.

### 2. Prompt Injection

Once we have the recalled memories, we inject them into the main system prompt. In our Next.js API route (`app/api/chat/route.ts`), we seamlessly blend the Hindsight context with our RAG and short-term memory contexts:

```typescript
const fullSystemPrompt = [
    systemPrompt,
    ragSystemMessage ? ragSystemMessage : '',
    memoryContextText ? memoryContextText : '',
    memoryAttributionText ? memoryAttributionText : '',
    hindsightContextText ? hindsightContextText : '',
].filter(Boolean).join('\n\n')
```

This approach allows the LLM to read through the established facts and learned patterns before answering, effectively giving it a long-term memory of the user and project.

### 3. The Fire-and-Forget Pattern (Retain)

The most critical operational rule for memory integration is: **Never let memory block the critical path.** 

We write chat responses to our database asynchronously. After the stream finishes, we trigger a save operation in `lib/ai/save-message.ts`. Here, we use a strict fire-and-forget pattern to send the conversation turn to Hindsight without awaiting the result on the main thread:

```typescript
// Hindsight long-term memory retention (fire-and-forget)
if (!saveError && userMessage && streamedContent) {
    retainConversationTurn({
        userId,
        projectId,
        userMessage,
        assistantResponse: streamedContent,
        conversationId,
    }).catch(e => logger.error('save-message', 'Hindsight retain failed (non-blocking)', e))
}
```

In `lib/hindsight/retain.ts`, we explicitly instruct the Hindsight SDK to handle the retention asynchronously:

```typescript
// 1. Retain in user bank (personal preferences & history)
await client.retain(getUserBankId(userId), content, {
  tags: baseTags,
  async: true, // Fire-and-forget on the Hindsight server side
})
```

Because we use `async: true` and trap errors with `.catch()`, our chat stream remains highly performant and resilient. If the memory service experiences latency or downtime, the core chat experience degrades gracefully (becoming stateless) rather than crashing.

## Results: Memory That Compounds

The impact of wiring up Hindsight was immediate. We started observing compounding context retrieval:
- **Message 1**: Recalled 0 memories. (The system knew nothing).
- **Message 2**: Recalled 20 memories. (Facts from the first turn were processed and recalled).
- **Message 3**: Recalled 28 memories. (Increasingly rich project context).
- **New Conversation**: Recalled 40 memories immediately based on the user's past habits and project context.

![VS Code terminal showing real Hindsight retain/recall server logs during development](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/vscode-terminal.png)
*Real development logs — you can see the Next.js server processing Hindsight retain and recall operations alongside normal requests.*

Instead of fighting the AI to establish baseline facts, users found that Wesley *remembered* the entities involved in their M&A deal, remembered that they preferred Delaware case law, and remembered the specific arguments they had explored yesterday.

![Wesley's Memory Intelligence panel showing "Adapting" stage with 13 learned facts and 13 legal entities](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/wesley-memory-panel.png)
*The Memory Intelligence panel in action — Wesley has reached the "Adapting" stage after learning 13 facts and identifying 13 legal entities from the user's research.*

## Lessons Learned

Integrating long-term memory into a production app taught us a few key lessons:

1. **Decouple Storage from Retrieval**: The Retain/Recall architecture allows the heavy lifting (entity extraction, graph resolution) to happen asynchronously in the background. If you try to do this synchronously in your chat pipeline, your latency will destroy the user experience.
2. **Partition Smartly**: Blanket memory is dangerous. A user's preference for output formatting is universal, but the facts of *Client A's* case must never leak into *Client B's* case. The multi-bank strategy is essential for security and relevance.
3. **Fail Gracefully**: Treat memory as an enhancement, not a dependency. By using fire-and-forget retention and non-blocking recall, we ensured that Wesley stays online even if the memory subsystems falter.
4. **Tune for Your Domain**: The default settings of a memory engine might not fit your use case. By configuring high skepticism and literalism, we tuned Hindsight specifically for the stringent requirements of legal research.

If you're building an AI application that feels trapped in a 50-message context window, it's time to add state. Check out the [Hindsight documentation](https://hindsight.vectorize.io/) to get started with building truly stateful agents.
