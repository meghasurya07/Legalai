# How Hindsight Turned 0 Recalled Facts Into 40 in Three Messages

I asked my legal AI the same question twice. The second time, it knew 40 things about me I never explicitly told it.

![Wesley's Memory Intelligence panel showing "Adapting" stage with 13 learned facts and legal entities](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/wesley-memory-panel.png)
*Wesley's Memory Intelligence panel visualizes how many facts the AI has learned about your legal research — here showing the "Adapting" stage with 13 learned facts.*

Every AI chat is fundamentally stateless. You can have a profound, hour-long conversation with a Large Language Model today, detailing the intricate nuances of a case, outlining your client's exact position, and establishing the specific state laws you're operating under. But if you close that browser tab and ask a follow-up question tomorrow, you get the same generic, blank-slate answer. The model has amnesia. 

For most consumer AI applications—like writing a quick email or summarizing a recipe—this amnesia is mildly annoying but acceptable. For legal research, it's an absolute showstopper. Legal research is intensely iterative. It builds on previous findings, preferred jurisdictions, and prior case law discussions. A lawyer doesn't just want an answer; they want an answer in the context of everything they've already uncovered. When an AI forgets everything you discussed yesterday, you're forced to spend the first ten minutes of every session re-establishing context. 

We needed a way to give our AI assistant, Wesley, genuine long-term memory. We didn't just want to stuff a prompt with previous messages; we wanted the system to actually learn. That's when we found [Hindsight](https://github.com/vectorize-io/hindsight). 

## What Hindsight Does

Hindsight is an open-source framework designed specifically for giving [agent memory](https://vectorize.io/what-is-agent-memory). Traditional vector databases are great for semantic search, but they aren't built for the dynamic, evolving nature of an agent's memory. Hindsight, on the other hand, is built around cognitive architectures.

At its core, Hindsight operates on three simple primitives:
- **Retain:** Store an interaction, fact, or snippet of context.
- **Recall:** Retrieve relevant, deduplicated context for a new query based on semantic relevance and temporal recency.
- **Reflect:** Asynchronously synthesize raw memories into higher-level insights, grouping facts and identifying patterns.

You can dive into the architecture in the [Hindsight documentation](https://hindsight.vectorize.io/), but the real magic is how remarkably simple it is to integrate into an existing codebase. 

![Architecture diagram showing Hindsight integration into Wesley's chat pipeline](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/architecture-diagram.jpg)
*Where Hindsight sits in Wesley's architecture: RECALL during context building, RETAIN after saving the response.*

## The Integration

Adding persistent memory to our application required two very localized, small changes. First, we needed to retrieve relevant context before sending a prompt to the LLM. We created a `recall.ts` utility that fetches memories from a user-specific "bank" and optionally a project-specific "bank."

Here's a look at the core of our `recall.ts` implementation:

```typescript
export async function recallHindsightMemories(params: {
  query: string
  userId: string
  projectId?: string | null
}): Promise<HindsightRecallResult> {
  if (!isHindsightConfigured()) {
    return { memories: [], contextText: '', count: 0 }
  }

  const { query, userId, projectId } = params
  const client = getHindsightClient()
  const allMemories: HindsightMemory[] = []

  try {
    // 1. Recall from user bank (global preferences)
    const userRecall = await client.recall(getUserBankId(userId), query, {
      budget: 'low', // Fast retrieval for chat latency
      maxTokens: 2000,
    })

    if (userRecall?.results) {
      allMemories.push(...userRecall.results.map(r => ({ ...r, source: 'hindsight' })))
    }

    // 2. Recall from project bank (if within a specific vault)
    if (projectId) {
      const projectRecall = await client.recall(getProjectBankId(projectId), query, {
        budget: 'low',
        maxTokens: 1500,
      })
      
      // Merge and deduplicate logic...
    }

    // 3. Build context text for LLM injection
    const contextText = formatHindsightContext(allMemories)

    return {
      memories: allMemories,
      contextText,
      count: allMemories.length,
    }
  } catch (err) {
    return { memories: [], contextText: '', count: 0 }
  }
}
```

The second piece of the puzzle was storing every conversation turn. After the assistant replies and we save the message to our database, we fire off a `retain` call. This function runs asynchronously so it doesn't block the user's response stream.

```typescript
export async function retainConversationTurn(params: {
  userId: string
  projectId?: string | null
  userMessage: string
  assistantResponse: string
  conversationId: string
  tags?: string[]
}): Promise<void> {
  if (!isHindsightConfigured()) return

  const client = getHindsightClient()
  const truncatedResponse = params.assistantResponse.slice(0, 8000)
  const content = `Legal Research Query: ${params.userMessage}\n\nWesley's Analysis: ${truncatedResponse}`

  try {
    // 1. Retain in user bank
    await client.retain(getUserBankId(params.userId), content, {
      tags: [`conversation:${params.conversationId}`],
      async: true, // Fire-and-forget on the server side
    })
    
    // (Project bank retention omitted for brevity)
  } catch (err) {
    logger.error('hindsight/retain', 'Failed to retain conversation turn', err)
  }
}
```

It looked great on paper. Three lines to recall, three lines to retain. I booted up the dev server, started a freeform chat, and asked a few detailed legal questions. Then I cleared my context and asked a follow-up. 

Wesley had no idea what I was talking about. Nothing was being remembered. 

## THE BUG

I spent an hour tracing network requests and checking environment variables. The API keys were correct. The client was initializing. But the Hindsight dashboard showed zero incoming retention requests.

Finally, I dug into `save-message.ts`, the file responsible for persisting chats to our database and orchestrating post-message background jobs. 

Here is what the logic looked like *before*:

```typescript
if (!saveError && projectId && streamedContent) {
    // Enqueue background jobs
    import('@/lib/jobs').then(j => {
        j.enqueueJob('MEMORY_EXTRACTION', { /* ... */ })
        j.enqueueJob('ARGUMENT_EXTRACTION', { /* ... */ })
    })

    // Hindsight long-term memory retention
    retainConversationTurn({
        userId,
        projectId,
        userMessage,
        assistantResponse: streamedContent,
        conversationId,
    }).catch(e => logger.error('save-message', 'Hindsight retain failed', e))
}
```

Do you see the glaring scoping issue? The `retain` call was nested deep inside an `if (projectId)` block. 

In our application, users can create specific "project vaults" to organize their research for a particular case, or they can just use the global chat interface for quick, one-off questions. For freeform global chats, `projectId` is naturally `null`. 

Because of this simple scoping error, memories were never being stored unless you were explicitly working inside a named project. I was testing in the global chat, so every single `retain` call was being skipped. 

The fix was embarrassingly simple. We just had to move the Hindsight retention code block entirely outside the `projectId` conditional. 

```typescript
if (!saveError && projectId && streamedContent) {
    // Enqueue background jobs for project vaults
    import('@/lib/jobs').then(j => {
        j.enqueueJob('MEMORY_EXTRACTION', { /* ... */ })
    })
}

// Hindsight long-term memory retention (fire-and-forget)
// Runs for ALL conversations — with or without a project vault
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

## Real Server Logs: The Learning Curve

With the bug squashed and the code deployed, I ran a fresh test. I wanted to see exactly how quickly the system built context. I started a conversation asking a question about sovereign immunity in Texas, followed up with a few related questions, and then opened a completely new conversation tab to ask a generic question about precedents. 

Here is the actual server output tracing the recall progression as I chatted:

```
[INFO] Recalled 0 memories for query "What are the leading precedents on sovereign immunity in Tex..."
[INFO] Retained conversation turn for user=auth0|xxx project=none
[INFO] Recalled 20 memories for query "How does Franchise Tax Bd. v. Hyatt affect interstate sovere..."
[INFO] Recalled 28 memories for query "What's the difference between qualified immunity and soverei..."
[INFO] Recalled 40 memories for query "What are the leading precedents on sovereign immunity?..."  ← NEW CONVERSATION
```

The progression was staggering. In just three messages, the system went from a complete blank slate to retrieving 40 relevant, highly specific memories for a completely new conversation. Because the new query vaguely touched on "sovereign immunity," Hindsight immediately pulled in the entire context of my previous Texas-specific research, ensuring the AI didn't start from zero.

![Terminal logs showing Hindsight memory growth from 0 to 40 recalled memories](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/terminal-logs.jpg)
*The actual server logs: memory count growing from 0 to 40 in just four messages.*

![VS Code terminal showing the live Next.js dev server processing Hindsight retain and recall operations](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/vscode-terminal.png)
*Our development environment — VS Code with the Next.js dev server showing Hindsight operations running alongside normal request logs.*

## Visualizing the Memory: The Memory Panel

Memory is an invisible, backend infrastructure feature. If it works perfectly, the user just thinks the AI is incredibly smart. But we wanted users to feel the progression. We wanted them to know that the AI was investing time in learning their specific practice areas.

To surface this intelligence, we built a `MemoryPanel` UI component (`memory-panel.tsx`). As the user asks more questions and Hindsight retains more context, the panel upgrades the user's visual "Learning Stage."

```tsx
function getLearningStage(count: number) {
  if (count === 0) return {
    label: 'New',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    description: 'Wesley hasn\'t learned about your work yet',
    icon: <Brain className="h-3.5 w-3.5" />,
  }
  if (count <= 10) return {
    label: 'Learning',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Wesley is starting to learn your preferences',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  }
  if (count <= 30) return {
    label: 'Adapting',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: 'Wesley is adapting to your legal research style',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  }
  return {
    label: 'Expert',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    description: 'Wesley deeply understands your legal work',
    icon: <Zap className="h-3.5 w-3.5" />,
  }
}
```

The panel provides a tangible progress bar. Users can actually watch their profile evolve from "New" to "Expert." They can expand the panel to see the exact legal entities the AI has extracted—like specific statutes, courts, or party names—and view the recent factual observations the system has verified.

## What Surprised Us

The most surprising part of this implementation was what Hindsight accomplished behind the scenes during its asynchronous reflection phase.

I expected the system to simply chunk our conversation text, embed it, and do naive semantic search. But Hindsight didn't just store verbatim conversation logs. It actively processed the interactions to extract atomic facts. 

More impressively, it auto-generated high-level, behavioral observations. When I audited the stored memories for my user bank, I didn't just find snippets of my chat history. I found synthesized, generalized observations like: 

*"User frequently researches sovereign immunity in Texas state courts."*

That is a piece of intelligence I never explicitly provided. The system observed my behavior across multiple messages, identified a pattern, and codified it as a permanent memory trait. The next time I asked a vague question, the LLM used that observation to bias its answer toward Texas law without me needing to specify the jurisdiction. 

## Lessons Learned

Adding agent memory fundamentally changed our application from a generic wrapper into a personalized research assistant. Here are my main takeaways from the journey:

1. **Statefulness is a massive moat.** Users hate repeating themselves. Once they experience an AI that actually remembers their jurisdiction preferences, past casework, and the nuances of their previous arguments, they won't go back to a stateless, amnesiac chatbot.
2. **Scoping bugs are silent killers.** If you attach telemetry, analytics, or retention calls to a conditional block, make absolutely sure you understand every execution path. Our simple `projectId` scoping bug meant a huge portion of our chats were completely failing to build memory, and there were no thrown errors to warn us.
3. **Make the invisible visible.** Memory happens entirely on the backend. Building the Memory Panel transformed a silent infrastructure upgrade into a core product feature that users actively care about and engage with.
4. **Reflection is infinitely better than retrieval.** Storing verbatim chat logs is easy, but it often leads to messy, contradictory context windows. Having an agent asynchronously synthesize those raw logs into clean atomic facts and behavioral observations is what actually makes the AI feel intelligent.
 
