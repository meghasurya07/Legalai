"use client"

import * as React from "react"
import { Search, Loader2, Building2, Scale, FileText, AlertTriangle, Users, Shield, DollarSign, Briefcase, RotateCcw, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"
import { TemplateResultHeader } from "@/components/templates/template-result-header"
import { TemplateProcessing } from "@/components/templates/template-processing"

interface LegalCompanyProfile {
    company: {
        name: string
        ticker: string
        cik: string
        industry: string
        incorporated: string
    }
    secFilings: {
        recent10K: string
        recent10Q: string
        recent8K: string[]
        keyHighlights: string[]
    }
    litigation: {
        ongoing: string[]
        material: string[]
        resolved: string[]
    }
    governance: {
        boardStructure: string
        keyCommittees: string[]
        policies: string[]
    }
    materialContracts: string[]
    regulatoryMatters: {
        compliance: string[]
        investigations: string[]
        sanctions: string[]
    }
    ownership: {
        majorShareholders: string[]
        insiderOwnership: string
        institutionalOwnership: string
    }
    legalRisks: {
        high: string[]
        medium: string[]
        low: string[]
    }
}

// ─── Section Copy Button ─────────────────────────────────
function SectionCopy({ content }: { content: string }) {
    const [copied, setCopied] = React.useState(false)
    const handleCopy = async () => {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        toast.success("Section copied")
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </Button>
    )
}

// ─── Markdown Export ─────────────────────────────────────
function formatProfileAsMarkdown(p: LegalCompanyProfile): string {
    let md = `# Legal Company Research Profile: ${p.company?.name || 'Unknown'}\n\n`
    md += `**Ticker:** ${p.company?.ticker || 'N/A'} | **CIK:** ${p.company?.cik || 'N/A'} | **Industry:** ${p.company?.industry || 'N/A'} | **Incorporated:** ${p.company?.incorporated || 'N/A'}\n\n`

    md += `## SEC Filings\n- Most Recent 10-K: ${p.secFilings?.recent10K || 'N/A'}\n- Most Recent 10-Q: ${p.secFilings?.recent10Q || 'N/A'}\n`
    if (p.secFilings?.recent8K?.length) { md += `- Recent 8-Ks: ${p.secFilings.recent8K.length} filings\n` }
    if (p.secFilings?.keyHighlights?.length) { md += `\n### Key Highlights\n`; p.secFilings.keyHighlights.forEach((h, i) => { md += `${i + 1}. ${h}\n` }) }
    md += '\n'

    if (p.litigation?.material?.length || p.litigation?.ongoing?.length || p.litigation?.resolved?.length) {
        md += `## Litigation\n`
        if (p.litigation.material?.length) { md += `### Material\n`; p.litigation.material.forEach(l => { md += `- ${l}\n` }) }
        if (p.litigation.ongoing?.length) { md += `### Ongoing\n`; p.litigation.ongoing.forEach(l => { md += `- ${l}\n` }) }
        if (p.litigation.resolved?.length) { md += `### Resolved\n`; p.litigation.resolved.forEach(l => { md += `- ${l}\n` }) }
        md += '\n'
    }

    md += `## Corporate Governance\n- Board Structure: ${p.governance?.boardStructure || 'N/A'}\n`
    if (p.governance?.keyCommittees?.length) { md += `- Committees: ${p.governance.keyCommittees.join(', ')}\n` }
    if (p.governance?.policies?.length) { md += `- Policies:\n`; p.governance.policies.forEach(pol => { md += `  - ${pol}\n` }) }
    md += '\n'

    if (p.materialContracts?.length) { md += `## Material Contracts\n`; p.materialContracts.forEach(c => { md += `- ${c}\n` }); md += '\n' }

    md += `## Regulatory Matters\n`
    if (p.regulatoryMatters?.compliance?.length) { md += `### Compliance\n`; p.regulatoryMatters.compliance.forEach(c => { md += `- ${c}\n` }) }
    if (p.regulatoryMatters?.investigations?.length) { md += `### Investigations\n`; p.regulatoryMatters.investigations.forEach(i => { md += `- ⚠️ ${i}\n` }) }
    if (p.regulatoryMatters?.sanctions?.length) { md += `### Sanctions\n`; p.regulatoryMatters.sanctions.forEach(s => { md += `- 🚫 ${s}\n` }) }
    md += '\n'

    md += `## Ownership Structure\n- Insider: ${p.ownership?.insiderOwnership || 'N/A'}\n- Institutional: ${p.ownership?.institutionalOwnership || 'N/A'}\n`
    if (p.ownership?.majorShareholders?.length) { md += `### Major Shareholders\n`; p.ownership.majorShareholders.forEach(s => { md += `- ${s}\n` }) }
    md += '\n'

    md += `## Legal Risk Assessment\n`
    if (p.legalRisks?.high?.length) { md += `### High Risk\n`; p.legalRisks.high.forEach(r => { md += `- 🔴 ${r}\n` }) }
    if (p.legalRisks?.medium?.length) { md += `### Medium Risk\n`; p.legalRisks.medium.forEach(r => { md += `- 🟡 ${r}\n` }) }
    if (p.legalRisks?.low?.length) { md += `### Low Risk\n`; p.legalRisks.low.forEach(r => { md += `- 🟢 ${r}\n` }) }

    return md
}

// ─── Processing steps ────────────────────────────────────
const PROCESSING_STEPS = [
    { label: "Initializing research", detail: "Setting up company research parameters..." },
    { label: "Searching public records", detail: "Querying SEC filings, news, and legal databases..." },
    { label: "Generating profile", detail: "Compiling due diligence report from all sources..." },
]

// ─── Main Component ──────────────────────────────────────
export default function CompanyProfile() {
    const {
        isRunning: isGenerating,
        result: profile,
        runWithJson,
        reset,
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    } = useTemplateWorkflow<LegalCompanyProfile>({
        apiEndpoint: '/api/templates/company-profile',
    })

    const [companyInput, setCompanyInput] = React.useState("")
    const [companyPrompt, setCompanyPrompt] = React.useState("")

    const handleGenerate = async () => {
        if (!companyInput.trim()) {
            toast.error("Please enter a company name or ticker symbol")
            return
        }
        await runWithJson(
            { company: companyInput, prompt: companyPrompt },
            "Legal company research profile generated!"
        )
    }

    const resetSearch = () => {
        setCompanyInput("")
        setCompanyPrompt("")
        reset()
    }

    return (
        <ToolPageLayout
            title="Company Research Profile"
            description="Legal due diligence and SEC filings analysis for public companies"
            icon={<Building2 className="h-4 w-4" />}
            accentColor="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
        >
            {isGenerating ? (
                <TemplateProcessing
                    steps={PROCESSING_STEPS}
                    activeStep={processingStep}
                    elapsedSeconds={elapsedSeconds}
                    accentColor="text-cyan-600 dark:text-cyan-400"
                />
            ) : error && !profile ? (
                <div className="max-w-md mx-auto text-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">Research Failed</h3>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button onClick={retry} variant="default" className="gap-2">
                            <RotateCcw className="h-4 w-4" /> Retry
                        </Button>
                        <Button onClick={resetSearch} variant="outline">Start Over</Button>
                    </div>
                </div>
            ) : !profile ? (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Search Company</CardTitle>
                        <p className="text-sm text-muted-foreground">Enter a company name or ticker for legal analysis (e.g., AAPL, Tesla, MSFT)</p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="company">Company Name or Ticker</Label>
                                <Input
                                    id="company"
                                    placeholder="e.g., Apple, Tesla, MSFT..."
                                    value={companyInput}
                                    onChange={(e) => setCompanyInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleGenerate() }}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prompt">Specific Focus (Optional)</Label>
                                <Textarea
                                    id="prompt"
                                    placeholder="e.g., Focus on environmental litigation, ongoing SEC investigations..."
                                    value={companyPrompt}
                                    onChange={(e) => setCompanyPrompt(e.target.value)}
                                    className="min-h-[120px] resize-none"
                                />
                            </div>
                            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-11 gap-2">
                                {isGenerating ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Conducting Due Diligence...</>
                                ) : (
                                    <><Search className="h-4 w-4" /> Generate Profile</>
                                )}
                            </Button>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Analysis Scope</p>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {['SEC Filings', 'Litigation History', 'Corporate Governance', 'Material Contracts', 'Regulatory Matters', 'Ownership Structure', 'Sanctions & Compliance', 'Legal Risk Assessment'].map(item => (
                                    <li key={item} className="text-[11px] flex items-center gap-1.5 text-muted-foreground/80">
                                        <div className="h-1 w-1 rounded-full bg-primary/40" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-5">
                    {/* Sticky Result Header */}
                    <TemplateResultHeader
                        title={`Company Profile: ${profile.company?.name || companyInput}`}
                        icon={<Building2 className="h-3.5 w-3.5" />}
                        accentColor="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                        generatedAt={generatedAt || undefined}
                        onReset={resetSearch}
                        resetLabel="New Search"
                        copyContent={formatProfileAsMarkdown(profile)}
                        downloadContent={formatProfileAsMarkdown(profile)}
                        downloadFilename={`company-profile-${(profile.company?.ticker || companyInput).toLowerCase()}-${new Date().toISOString().split('T')[0]}.md`}
                    />

                    {/* Company Header */}
                    <Card className="overflow-hidden">
                        <div className="bg-cyan-500/5 px-6 py-4 border-b">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1.5">
                                    <h2 className="text-xl font-bold tracking-tight">{profile.company?.name}</h2>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {profile.company?.ticker && <Badge variant="secondary">{profile.company.ticker}</Badge>}
                                        {profile.company?.cik && <Badge variant="outline">CIK: {profile.company.cik}</Badge>}
                                        {profile.company?.industry && (
                                            <>
                                                <Separator orientation="vertical" className="h-4" />
                                                <span className="text-xs text-muted-foreground">{profile.company.industry}</span>
                                            </>
                                        )}
                                        {profile.company?.incorporated && (
                                            <>
                                                <Separator orientation="vertical" className="h-4" />
                                                <span className="text-xs text-muted-foreground">Inc. {profile.company.incorporated}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* SEC Filings */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    SEC Filings Summary
                                    <div className="ml-auto"><SectionCopy content={`10-K: ${profile.secFilings?.recent10K}\n10-Q: ${profile.secFilings?.recent10Q}\n8-Ks: ${profile.secFilings?.recent8K?.length || 0} filings`} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-K</p>
                                        <p className="text-xs font-mono text-muted-foreground/80 bg-muted/20 p-2 rounded-md border truncate hover:whitespace-normal cursor-help">{profile.secFilings?.recent10K || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-Q</p>
                                        <p className="text-xs font-mono text-muted-foreground/80 bg-muted/20 p-2 rounded-md border truncate hover:whitespace-normal cursor-help">{profile.secFilings?.recent10Q || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent 8-Ks</p>
                                        <div className="p-2 rounded-md bg-primary/5 border border-primary/10 inline-flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-xs">{profile.secFilings?.recent8K?.length || 0}</Badge>
                                            <span className="text-xs font-medium text-primary/80">Filings Detected</span>
                                        </div>
                                    </div>
                                </div>
                                {profile.secFilings?.keyHighlights?.length > 0 && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Key Highlights</p>
                                            <ul className="space-y-2">
                                                {profile.secFilings.keyHighlights.map((highlight, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2.5">
                                                        <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">{i + 1}</span>
                                                        <span className="text-foreground/90">{highlight}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Litigation — now renders ALL three categories including resolved */}
                    {(profile.litigation?.material?.length > 0 || profile.litigation?.ongoing?.length > 0 || profile.litigation?.resolved?.length > 0) && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                            <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        Litigation & Legal Disputes
                                        <div className="ml-auto"><SectionCopy content={[...(profile.litigation?.material || []), ...(profile.litigation?.ongoing || []), ...(profile.litigation?.resolved || [])].join('\n')} /></div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {profile.litigation?.material?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold tracking-wide uppercase text-red-600 dark:text-red-400 mb-2">Material Litigation</p>
                                            <ul className="space-y-1.5">
                                                {profile.litigation.material.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-red-500/40 pl-3 py-0.5 text-foreground/90">{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {profile.litigation?.ongoing?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 mb-2">Ongoing Cases</p>
                                            <ul className="space-y-1.5">
                                                {profile.litigation.ongoing.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-amber-500/30 pl-3 py-0.5 text-foreground/90">{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {profile.litigation?.resolved?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">Resolved Cases</p>
                                            <ul className="space-y-1.5">
                                                {profile.litigation.resolved.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-emerald-500/30 pl-3 py-0.5 text-foreground/90">{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Corporate Governance */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                                        <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    Corporate Governance
                                    <div className="ml-auto"><SectionCopy content={`Board: ${profile.governance?.boardStructure}\nCommittees: ${profile.governance?.keyCommittees?.join(', ')}`} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {profile.governance?.boardStructure && (
                                    <div className="bg-muted/20 p-4 rounded-lg border">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Board Structure</p>
                                        <p className="text-sm text-foreground/90 leading-relaxed">{profile.governance.boardStructure}</p>
                                    </div>
                                )}
                                {profile.governance?.keyCommittees?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Key Committees</p>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.governance.keyCommittees.map((committee, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs">{committee}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {profile.governance?.policies?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Governance Policies</p>
                                        <ul className="space-y-1.5">
                                            {profile.governance.policies.map((policy, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                                    <span className="text-foreground/90">{policy}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Material Contracts */}
                    {profile.materialContracts?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                                            <Briefcase className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                        </div>
                                        Material Contracts
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{profile.materialContracts.length}</Badge>
                                        <SectionCopy content={profile.materialContracts.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {profile.materialContracts.map((contract, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                                <FileText className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                                                <span className="text-foreground/90 font-medium">{contract}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Regulatory Matters — now renders sanctions */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                        <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    Regulatory Matters
                                    <div className="ml-auto"><SectionCopy content={[...(profile.regulatoryMatters?.compliance || []), ...(profile.regulatoryMatters?.investigations || []), ...(profile.regulatoryMatters?.sanctions || [])].join('\n')} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {profile.regulatoryMatters?.compliance?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">Compliance Framework</p>
                                        <ul className="space-y-1.5">
                                            {profile.regulatoryMatters.compliance.map((item, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-emerald-500/40 pl-3 py-0.5 text-foreground/90">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {profile.regulatoryMatters?.investigations?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 mb-2">Investigations</p>
                                        <ul className="space-y-1.5">
                                            {profile.regulatoryMatters.investigations.map((item, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                                    <span className="text-foreground/90">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {profile.regulatoryMatters?.sanctions?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-red-600 dark:text-red-400 mb-2">Sanctions</p>
                                        <ul className="space-y-1.5">
                                            {profile.regulatoryMatters.sanctions.map((item, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 rounded-md bg-red-500/5 p-2.5 border border-red-500/20">
                                                    <Shield className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                                    <span className="text-foreground/90 font-medium">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {(!profile.regulatoryMatters?.compliance?.length && !profile.regulatoryMatters?.investigations?.length && !profile.regulatoryMatters?.sanctions?.length) && (
                                    <p className="text-sm text-muted-foreground italic">No significant regulatory matters identified.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Ownership */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-teal-500/10 flex items-center justify-center">
                                        <DollarSign className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    Ownership Structure
                                    <div className="ml-auto"><SectionCopy content={`Insider: ${profile.ownership?.insiderOwnership}\nInstitutional: ${profile.ownership?.institutionalOwnership}\nShareholders: ${profile.ownership?.majorShareholders?.join(', ')}`} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-muted/20 p-3 rounded-lg border text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Insider Ownership</p>
                                        <p className="text-lg font-bold font-mono">{profile.ownership?.insiderOwnership || 'N/A'}</p>
                                    </div>
                                    <div className="bg-muted/20 p-3 rounded-lg border text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Institutional Ownership</p>
                                        <p className="text-lg font-bold font-mono">{profile.ownership?.institutionalOwnership || 'N/A'}</p>
                                    </div>
                                </div>
                                {profile.ownership?.majorShareholders?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Major Shareholders</p>
                                        <ul className="space-y-1.5">
                                            {profile.ownership.majorShareholders.map((holder, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-teal-500/30 pl-3 py-0.5 text-foreground/90">{holder}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Legal Risks — now renders all three tiers including low */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-red-500/10 flex items-center justify-center">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                    </div>
                                    Legal Risk Assessment
                                    <div className="ml-auto"><SectionCopy content={[...(profile.legalRisks?.high || []).map(r => `[HIGH] ${r}`), ...(profile.legalRisks?.medium || []).map(r => `[MED] ${r}`), ...(profile.legalRisks?.low || []).map(r => `[LOW] ${r}`)].join('\n')} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {profile.legalRisks?.high?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-red-600 dark:text-red-400 mb-2">High Risk</p>
                                        <ul className="space-y-1.5">
                                            {profile.legalRisks.high.map((risk, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 rounded-md bg-red-500/5 p-2.5 border border-red-500/20">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                                    <span className="text-foreground/90 font-medium">{risk}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {profile.legalRisks?.medium?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 mb-2">Medium Risk</p>
                                        <ul className="space-y-1.5">
                                            {profile.legalRisks.medium.map((risk, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-amber-500/40 pl-3 py-0.5 text-foreground/90">{risk}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {profile.legalRisks?.low?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">Low Risk</p>
                                        <ul className="space-y-1.5">
                                            {profile.legalRisks.low.map((risk, i) => (
                                                <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-emerald-500/30 pl-3 py-0.5 text-foreground/90">{risk}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {(!profile.legalRisks?.high?.length && !profile.legalRisks?.medium?.length && !profile.legalRisks?.low?.length) && (
                                    <p className="text-sm text-muted-foreground italic">No significant legal risks identified.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </ToolPageLayout>
    )
}
