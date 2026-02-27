import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function POST() {
    try {
        // 1. Clear existing workflows (optional, but ensures no duplicates if we're re-seeding)
        // Note: In a real prod app with user data attached to workflows, this would be dangerous. 
        // For this MVP where workflows are static definitions, it's safer.
        // However, to be safe, we'll use UPSERT (insert on conflict update) logic instead of delete.

        const workflows = [
            { id: 'redline-analysis', title: 'Redline analysis', description: 'Redline Analysis generates a chart comparing the original and revised version of a redline document. It also helps you identify or generate a response to your query based on the redline document.', icon: 'FileCheck' },
            { id: 'company-profile', title: 'Company research profile', description: 'Company Research Profile will generate a report on any NYSE or NASDAQ listed company that files 10-Ks with the SEC by searching and summarizing publicly available data such as EDGAR.', icon: 'FileText' },
            { id: 'document-comparison', title: 'Document comparison', description: 'Document Comparison will describe the difference between two documents with vastly different formats but with overlapping substance.', icon: 'Copy' },
            { id: 'transcripts', title: 'Transcripts', description: 'Transcripts surfaces and summarizes key themes from your trial and deposition transcripts. It also allows users to query those transcripts to further develop key themes and additional insights.', icon: 'FileSignature' },
            { id: 'translation', title: 'Translate into Another Language', description: 'Instantly translate legal documents, contracts, and communications into multiple languages while maintaining legal terminology accuracy and context.', icon: 'Languages' },
            { id: 'draft-from-template', title: 'Draft from Template', description: 'Generate legal documents from pre-approved templates. Customize contracts, agreements, and legal letters with your specific requirements and client information.', icon: 'FileEdit' },
            { id: 'client-alert', title: 'Draft a Client Alert', description: 'Create professional client alerts and legal updates. Communicate important legal developments, regulatory changes, and case updates to your clients effectively.', icon: 'FileWarning' },
            { id: 'legal-memo', title: 'Draft Memo from Legal Research', description: 'Transform legal research into comprehensive memorandums. Analyze case law, statutes, and regulations to create well-structured legal memos for your cases.', icon: 'Gavel' },
            { id: 'contract-analysis', title: 'Contract Analysis', description: 'Perform deep analysis of contracts to identify key clauses, obligations, risks, and opportunities. Extract important dates, parties, and terms with AI-powered precision.', icon: 'ScanSearch' }
        ]

        const { error } = await supabase
            .from('templates')
            .upsert(workflows, { onConflict: 'id' })

        if (error) {
            console.error('Error seeding workflows:', error)
            return NextResponse.json({ error: 'Failed to seed workflows' }, { status: 500 })
        }

        return NextResponse.json({ success: true, count: workflows.length })
    } catch (error) {
        console.error('Error in /api/admin/seed:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
