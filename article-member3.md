# I Taught My AI to Think Like a Skeptical Lawyer Using Hindsight

Legal AI has a trust problem. In a domain where a single hallucinated case citation can get a lawyer sanctioned by a judge, professionals need absolute precision, not probabilistic guessing. They don't want an AI that tries to please them; they want an AI that questions them, verifies claims, and remembers exactly what they are working on. So, instead of just feeding more legal documents into a prompt, we decided to give our AI a memory and teach it to be a skeptic.

![Wesley's home interface — a legal AI built for lawyers](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/wesley-home.png)
*Wesley's clean interface — but underneath runs a memory system tuned specifically for legal rigor.*

## The Problem With Generic AI for Legal Work

When a lawyer sits down to use generic AI platforms, they hit a wall of amnesia and unwarranted confidence. The AI starts from scratch every session. It forgets that the user practices in Texas state courts, not federal courts. It forgets the specific citation style the user prefers. It fails to grasp that the lawyer has been researching the exact same niche area of contract law for the past three days.

Worst of all, to be "helpful," a generic large language model will happily invent cases that sound perfectly plausible but don't exist. Generic models are designed to generate text that looks correct, which is fundamentally at odds with legal research, where text must actually *be* correct and traceable to an authoritative source. 

## Why Legal Research Needs Memory

A lawyer's work compounds. Case A informs the strategy for Case B. Jurisdiction preferences carry across multiple matters. The citation patterns a lawyer uses reveal their specific areas of expertise. If an AI doesn't have [agent memory](https://vectorize.io/what-is-agent-memory), it cannot build a relationship with a lawyer's practice over time. Memory isn't just about caching past chats; it's about synthesizing habits and context.

When a lawyer says, "Find me similar cases," the AI should already know what "similar" means in the context of their past five queries. It should know whether they prefer cases from the 5th Circuit or state supreme courts. This is why we realized early on that an LLM alone wasn't enough. We needed a dedicated memory layer.

## Hindsight's Disposition System

To fix the trust issue, we integrated [Hindsight](https://github.com/vectorize-io/hindsight). Hindsight allows us to configure the "disposition" of the AI's memory bank. For legal work, we cranked up skepticism and literalism. 

Here is how we configured our legal bank in `config.ts`:

```typescript
export async function configureLegalBank(bankId: string): Promise<void> {
  if (!isHindsightConfigured()) return

  const client = getHindsightClient()

  try {
    await client.updateBankConfig(bankId, {
      reflectMission: 'Wesley is a legal research AI assistant that helps lawyers, law students, and legal professionals research case law, analyze contracts, draft legal documents, and understand complex legal concepts. Wesley builds deep expertise about each user\'s practice areas, jurisdiction preferences, frequently referenced cases, and legal research patterns over time.',
      dispositionSkepticism: 4,   // High — verify legal claims rigorously
      dispositionLiteralism: 4,   // High — precise citations and exact legal language
      dispositionEmpathy: 3,      // Moderate — professional and supportive
      enableObservations: true,   // Auto-consolidate learned patterns
      enableAutoConsolidation: true,
      enableGraphRetrieval: true, 
      enableTemporalRetrieval: true, 
    })
    logger.info('hindsight/config', `Configured legal bank: ${bankId}`)
  } catch (err) {
    logger.warn('hindsight/config', `Bank config failed for ${bankId}`, err)
  }
}
```

Setting `dispositionSkepticism` to 4 means the AI is instructed to rigorously verify claims rather than blindly accepting them. Setting `dispositionLiteralism` to 4 ensures it prioritizes exact legal language and precise citations. It forces the memory system to store facts with strict fidelity. This prevents the memory layer from abstracting away the nuance that makes legal arguments work.

![Architecture diagram showing how Hindsight integrates into Wesley's legal AI stack](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/architecture-diagram.jpg)
*Hindsight's retain-recall-reflect architecture integrated into Wesley's Next.js chat pipeline — dispositions shape how every memory is stored and retrieved.*

## How Observations Work in Practice

Hindsight doesn't just act as a dumb storage bin for raw text. It actively processes interactions to form higher-level observations. When `enableObservations` is true, Hindsight runs background jobs to look at the raw experiences and consolidate them into patterns.

If you have a few conversations about Texas sovereign immunity, Hindsight auto-generates observations like "user frequently researches sovereign immunity cases in Texas state courts". But it goes deeper. Over time, observations might look like this:
- "The user prefers to cite persuasive authority from the 5th Circuit when dealing with interlocutory appeals."
- "The user's primary practice area appears to be commercial real estate litigation in Travis County."
- "The user consistently checks for subsequent history on cases from the 1990s involving strict liability."

When we recall memories, we group them into structured categories for the LLM context. You can see this in our `recall.ts` formatting logic:

```typescript
function formatHindsightContext(memories: HindsightMemory[]): string {
  if (memories.length === 0) return ''

  const lines: string[] = [
    '## 🧠 Long-Term Memory (Hindsight)',
    `Wesley has learned the following from your past legal research sessions (${memories.length} relevant memories):`,
    '',
  ]

  const facts = memories.filter(m => m.type === 'world')
  const experiences = memories.filter(m => m.type === 'experience')
  const observations = memories.filter(m => m.type === 'observation')

  if (facts.length > 0) {
    lines.push('### Established Legal Facts')
    facts.forEach(m => lines.push(`- ${m.text}`))
    lines.push('')
  }

  if (observations.length > 0) {
    lines.push('### Learned Patterns & Preferences')
    observations.forEach(m => lines.push(`- ${m.text}`))
    lines.push('')
  }

  // ... (experiences added similarly)

  lines.push(
    '[INSTRUCTION: Use these memories to personalize your response. Reference past research when relevant.',
    'If the user has a known jurisdiction preference, apply it. Build on prior case discussions rather than starting from scratch.]',
  )

  return lines.join('\n')
}
```

This auto-consolidation means the AI continually gets smarter about *how* the user practices law, without the user having to explicitly state "I am a Texas litigator." For deeper technical details on these types, check out the [Hindsight documentation](https://hindsight.vectorize.io/).

## The Reflect API

To expose what the AI has learned back to the user, we use Hindsight's `reflect` API. This synthesizes everything the system has gathered about a user's practice areas into a coherent summary. 

In our insights route (`route.ts`), we ask Hindsight to reflect on the user's patterns:

```typescript
    const defaultQuery = projectId
      ? 'What are the key legal themes, parties, case strategies, and important facts in this project? What patterns have emerged from the research?'
      : 'What are this user\'s legal research patterns, jurisdiction preferences, frequently referenced case law, and practice areas? How has their research evolved over time?'

    // 1. Reflect — synthesize insights from accumulated memories
    const reflection = await client.reflect(bankId, query || defaultQuery, {
      budget: 'mid',
      includeFacts: true,
    })
```

A lawyer can literally ask, "What do you know about my research?" and get a structured, synthesized profile that proves the AI is paying attention. The response from the Reflect API is typically a well-structured markdown document that highlights key areas. A real output might look something like this:

```markdown
### Practice Areas
- **Commercial Litigation**: Extensive research history regarding breach of contract, fiduciary duties, and tortious interference.
- **Sovereign Immunity**: Deep dives into Texas Tort Claims Act exceptions.

### Jurisdiction Preferences
- **Primary**: Texas State Courts (Travis and Harris counties).
- **Secondary**: 5th Circuit Court of Appeals.

### Frequently Referenced Cases
- *City of Dallas v. Albert*, 354 S.W.3d 368 (Tex. 2011)
- *Ryder Integrated Logistics, Inc. v. Fayette Cty.*, 453 S.W.3d 922 (Tex. 2015)

### Research Patterns
- The user consistently verifies the subsequent history and negative treatment of historical cases prior to drafting memos.
- Demonstrates a preference for strict textualist interpretations when analyzing statutory clauses.
```

This level of insight transforms the tool from a basic chatbot into a trusted research partner that understands the lawyer's specific focus.

## Multi-Bank Isolation

Legal work demands strict confidentiality and context boundaries. You don't want the facts of Case A leaking into the strategy for Case B. We solve this using a multi-bank strategy in `client.ts`:

```typescript
export function getUserBankId(userId: string): string {
  // Sanitize Auth0 IDs
  const sanitized = userId.replace(/[|:]/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '')
  return `wesley-user-${sanitized}`
}

export function getProjectBankId(projectId: string): string {
  return `wesley-project-${projectId}`
}
```

Per-user banks keep personal preferences like jurisdiction and citation style. Per-project banks keep case-specific context like parties, key cases, and arguments completely isolated. This means we can safely query the project bank for specific matter details without pulling in irrelevant information from a completely different lawsuit.

## Real Examples from Testing

In our testing, we saw the power of this memory model. We ran a session researching Texas sovereign immunity. When we called the `retain` function with a conversational turn, Hindsight didn't just store the paragraph. It extracted six atomic facts from that single call, automatically linking entities like specific case names. 

![VS Code terminal showing Hindsight retain and recall operations in the Next.js dev server](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/vscode-terminal.png)
*Real development logs — the Next.js server processing Hindsight retain and recall operations in real time.*

Then, when we hit the Reflect API, it generated the structured legal research profile noting a strong focus on "Texas state court procedures" and "sovereign immunity defenses", preparing the AI to instantly apply that lens to future queries.

![Wesley's Memory Intelligence panel showing "Adapting" stage with 13 learned facts and 13 legal entities](https://raw.githubusercontent.com/meghasurya07/Legalai/main/public/images/articles/wesley-memory-panel.png)
*The Memory Intelligence panel in action — Wesley has reached the "Adapting" stage, tracking 13 learned facts and 13 legal entities from the user's sovereign immunity research.*

## What We Learned

Building a domain-specific AI with memory taught us several crucial lessons about trust and system design:

1. **Memory creates trust faster than intelligence.** An AI that remembers a user's local court rules and past arguments feels more reliable than an AI that can generate brilliant prose but forgets who the client is.
2. **Disposition tuning is essential for vertical AI.** A "helpful and harmless" default disposition is terrible for law. You need an AI that defaults to skeptical verification and literal interpretation of text.
3. **Implicit observations beat explicit preferences.** Users rarely take the time to fill out settings forms or prompt the AI with their entire background. Hindsight's ability to observe behavior and consolidate it into facts means the system adapts organically.
4. **Data isolation is a feature, not just a security requirement.** Multi-bank isolation isn't just about compliance; it's about context relevance. Keeping project facts siloed prevents cross-contamination of legal strategies.

## The Future of Legal AI

There is a profound difference between an AI that gives you Wikipedia-style generic answers and an AI that builds a relationship with your practice. By leveraging agent memory with a skeptical, literal disposition, we've moved from a stochastic parrot to a tool that actually compounds in value the more you use it. For legal professionals, an AI that remembers the details and demands precision isn't just a nice feature—it's the only way they'll ever trust it.
 
