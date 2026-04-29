import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { logger } from '@/lib/logger'

const SEED_PROMPTS = [
    {
        title: 'Contract Risk Summary',
        content: 'Analyze the following contract and produce a structured risk summary.\n\nFor each risk identified:\n1. Risk category (financial, operational, legal, compliance)\n2. Severity (critical, high, medium, low)\n3. Clause reference (section number)\n4. Current position in the contract\n5. Recommended mitigation or amendment\n\nOutput as a structured table. Focus on {{focus_areas}} risks in the jurisdiction of {{jurisdiction}}.',
        description: 'Generates a comprehensive risk assessment table from any contract.',
        category: 'Corporate',
        type: 'prompt',
        tags: ['risk', 'analysis', 'contract', 'due-diligence'],
        variables: [
            { name: 'focus_areas', label: 'Focus Areas', type: 'select', required: false, defaultValue: 'all', options: ['all', 'financial', 'operational', 'legal', 'compliance'] },
            { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: false, defaultValue: 'United States' },
        ],
        access_level: 'global',
        is_pinned: true,
    },
    {
        title: 'SPA Indemnity Analysis',
        content: 'Review the attached Share Purchase Agreement and:\n1. Identify all indemnity provisions\n2. Flag any uncapped liability\n3. Compare against our standard position ({{standard_cap}})\n4. List any missing standard protections\n5. Output as a structured table with clause reference, current position, and recommended amendment',
        description: 'Analyzes indemnity clauses in SPAs against firm standards.',
        category: 'M&A',
        type: 'prompt',
        tags: ['indemnity', 'SPA', 'buyer-side', 'due-diligence'],
        variables: [
            { name: 'standard_cap', label: 'Standard Cap Position', type: 'select', required: true, options: ['2x purchase price', '1x purchase price', 'uncapped', 'de minimis basket'] },
        ],
        access_level: 'global',
        is_pinned: true,
    },
    {
        title: 'NDA Clause Review',
        content: 'Review this NDA and assess each clause against these standards:\n\n- Confidentiality scope: Should be mutual\n- Duration: Should not exceed {{max_years}} years\n- Permitted disclosures: Must include employees and advisors on need-to-know\n- Non-solicitation: Flag if present — this is outside NDA scope\n- Governing law: Preferred {{jurisdiction}}\n\nFor each clause, state: ✅ Acceptable / ⚠️ Non-standard (explain) / ❌ Red line (explain)',
        description: 'Quick NDA review against standard positions.',
        category: 'Corporate',
        type: 'prompt',
        tags: ['NDA', 'confidentiality', 'review'],
        variables: [
            { name: 'max_years', label: 'Max Duration (years)', type: 'text', required: false, defaultValue: '3' },
            { name: 'jurisdiction', label: 'Preferred Governing Law', type: 'text', required: false, defaultValue: 'England & Wales' },
        ],
        access_level: 'global',
    },
    {
        title: 'Force Majeure Assessment',
        content: 'Analyze the force majeure clause in this contract:\n\n1. List all triggering events covered\n2. Identify if pandemics/epidemics are explicitly covered\n3. Assess notice requirements and cure periods\n4. Check if there is an obligation to mitigate\n5. Determine termination rights if FM continues beyond {{fm_period}}\n6. Compare against market-standard FM provisions\n\nProvide a risk rating (1-5) and recommended amendments.',
        description: 'Detailed force majeure clause analysis with risk scoring.',
        category: 'Litigation',
        type: 'prompt',
        tags: ['force-majeure', 'risk', 'clause-review'],
        variables: [
            { name: 'fm_period', label: 'FM Continuation Period', type: 'text', required: false, defaultValue: '90 days' },
        ],
        access_level: 'global',
    },
    {
        title: 'Compliance Checklist Generator',
        content: 'Generate a compliance checklist for {{regulation}} applicable to {{entity_type}} in {{jurisdiction}}.\n\nFor each requirement:\n1. Regulatory reference\n2. Requirement summary\n3. Compliance status options (compliant / partially compliant / non-compliant / not applicable)\n4. Key evidence needed\n5. Deadline or frequency of review\n\nOutput as a structured checklist table.',
        description: 'Creates regulatory compliance checklists for any jurisdiction.',
        category: 'Compliance',
        type: 'prompt',
        tags: ['compliance', 'regulatory', 'checklist'],
        variables: [
            { name: 'regulation', label: 'Regulation', type: 'text', required: true },
            { name: 'entity_type', label: 'Entity Type', type: 'select', required: true, options: ['corporation', 'partnership', 'fund', 'bank', 'insurance company'] },
            { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: true },
        ],
        access_level: 'global',
    },
    {
        title: 'NDA Review Playbook',
        content: 'Automated clause-by-clause NDA assessment using firm-standard positions. Runs against defined rules to flag non-standard terms and suggest redlines.',
        description: 'Structured playbook for automated NDA review with standard/redline/fallback positions.',
        category: 'Corporate',
        type: 'playbook',
        tags: ['NDA', 'playbook', 'redline', 'automated'],
        rules: [
            { id: 'r1', clauseName: 'Confidentiality Definition', standardPosition: 'Mutual, covering technical and commercial information', redLine: 'One-way confidentiality only', fallbackPosition: 'Mutual with carve-outs for publicly available info', action: 'flag' },
            { id: 'r2', clauseName: 'Term & Duration', standardPosition: '3 years from effective date', redLine: 'Perpetual / no expiry', fallbackPosition: '5 years with renewal option', action: 'suggest_redline' },
            { id: 'r3', clauseName: 'Permitted Disclosures', standardPosition: 'Employees, advisors, affiliates on need-to-know basis', redLine: 'No permitted disclosure provision', fallbackPosition: 'Add standard disclosure carve-outs', action: 'insert_clause' },
            { id: 'r4', clauseName: 'Return of Materials', standardPosition: 'Return or destroy within 30 days of termination', redLine: 'No return obligation', fallbackPosition: 'Return or certify destruction within 60 days', action: 'flag' },
            { id: 'r5', clauseName: 'Governing Law', standardPosition: 'England & Wales', redLine: 'Jurisdiction of counterparty only', fallbackPosition: 'Neutral jurisdiction (Singapore, DIFC)', action: 'suggest_redline' },
        ],
        access_level: 'global',
        is_pinned: true,
    },
    {
        title: 'Force Majeure Review — Golden Reference',
        content: 'Does this clause adequately protect us against pandemic-related supply disruptions?',
        description: 'Example showing what a good FM analysis looks like — prompt, sources, and expected output quality.',
        category: 'Litigation',
        type: 'example',
        tags: ['example', 'force-majeure', 'training', 'best-practice'],
        example_input: 'Does this clause adequately protect us against pandemic-related supply disruptions? Review against the attached contract and COVID-19 precedent database.',
        example_output: '## Force Majeure Analysis\n\n### Coverage Assessment\nThe FM clause (Section 14.2) lists "epidemics" but does NOT explicitly cover "pandemics" or "government-mandated lockdowns."\n\n### Key Findings\n| # | Issue | Severity | Recommendation |\n|---|---|---|---|\n| 1 | No pandemic coverage | High | Add "pandemics, epidemics, and government-mandated restrictions" |\n| 2 | No mitigation obligation | Medium | Add best-efforts mitigation language |\n| 3 | Cure period is 180 days | Low | Market standard; acceptable |\n\n### Conclusion\nThe clause provides **partial** protection. We recommend amendments to items 1 and 2 before execution.',
        access_level: 'global',
    },
]

// POST /api/prompt-library/seed — Seed library with starter prompts
export async function POST() {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId, userName } = auth

        // Get user's org
        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        // Check if already seeded
        const { count } = await supabase
            .from('prompt_library')
            .select('*', { count: 'exact', head: true })
            .eq('access_level', 'global')

        if (count && count > 0) {
            return NextResponse.json({ message: 'Library already seeded', count })
        }

        const prompts = SEED_PROMPTS.map(p => ({
            ...p,
            user_id: userId,
            org_id: membership?.org_id || null,
            created_by_name: userName,
            usage_count: 0,
            variables: p.variables || [],
            source_references: [],
            rules: p.rules || [],
        }))

        const { data, error } = await supabase
            .from('prompt_library')
            .insert(prompts)
            .select()

        if (error) {
            logger.error('Error seeding prompt library:', 'Error', error)
            return NextResponse.json({ error: 'Failed to seed library' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Library seeded successfully', count: data.length })
    } catch (error) {
        logger.error('Error in POST /api/prompt-library/seed:', 'Error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
