"use client"

import * as React from "react"
import { Search, Loader2, Building2, Scale, FileText, AlertTriangle, Users, Shield, DollarSign, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"

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

export default function CompanyProfile() {
    const searchParams = useSearchParams()
    const chatId = searchParams.get('chatId')

    const [companyInput, setCompanyInput] = React.useState("")
    const [companyPrompt, setCompanyPrompt] = React.useState("")
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [profile, setProfile] = React.useState<LegalCompanyProfile | null>(null)

    React.useEffect(() => {
        if (!chatId) return
        const loadHistory = async () => {
            setIsGenerating(true)
            try {
                const res = await fetch(`/api/chat/conversations/${chatId}/messages`)
                if (res.ok) {
                    const messages = await res.json()
                    const assistantMsg = messages.find((m: { role: string; content: string }) => m.role === 'assistant')
                    if (assistantMsg) {
                        try {
                            const parsedData = JSON.parse(assistantMsg.content)
                            setProfile(parsedData)
                        } catch (e) {
                            console.error("Failed to parse history content:", e)
                            toast.error("Failed to load past result")
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch history:", error)
            } finally {
                setIsGenerating(false)
            }
        }
        loadHistory()
    }, [chatId])

    const handleGenerate = async () => {
        if (!companyInput.trim()) {
            toast.error("Please enter a company name or ticker symbol")
            return
        }
        setIsGenerating(true)
        try {
            const response = await fetch('/api/templates/company-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: companyInput, prompt: companyPrompt })
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate profile')
            }
            const data = await response.json()
            setProfile(data)
            toast.success("Legal company research profile generated!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to generate company research profile"
            toast.error(message)
        } finally {
            setIsGenerating(false)
        }
    }

    const resetSearch = () => {
        setCompanyInput("")
        setCompanyPrompt("")
        setProfile(null)
    }

    return (
        <ToolPageLayout
            title="Company Research Profile"
            description="Legal due diligence and SEC filings analysis for public companies"
            icon={<Building2 className="h-4 w-4" />}
            accentColor="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
        >
            {!profile ? (
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
                                {['SEC Filings', 'Litigation History', 'Corporate Governance', 'Material Contracts', 'Regulatory Matters', 'Ownership Structure'].map(item => (
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
                    {/* Company Header */}
                    <Card className="overflow-hidden">
                        <div className="bg-cyan-500/5 px-6 py-4 border-b">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1.5">
                                    <h2 className="text-xl font-bold tracking-tight">{profile.company.name}</h2>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">{profile.company.ticker}</Badge>
                                        <Badge variant="outline">CIK: {profile.company.cik}</Badge>
                                        <Separator orientation="vertical" className="h-4" />
                                        <span className="text-xs text-muted-foreground">{profile.company.industry}</span>
                                        <Separator orientation="vertical" className="h-4" />
                                        <span className="text-xs text-muted-foreground">Inc. {profile.company.incorporated}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* SEC Filings */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                SEC Filings Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-K</p>
                                    <p className="text-xs font-mono text-muted-foreground/80 bg-muted/20 p-2 rounded-md border truncate hover:whitespace-normal cursor-help">{profile.secFilings.recent10K}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-Q</p>
                                    <p className="text-xs font-mono text-muted-foreground/80 bg-muted/20 p-2 rounded-md border truncate hover:whitespace-normal cursor-help">{profile.secFilings.recent10Q}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent 8-Ks</p>
                                    <div className="p-2 rounded-md bg-primary/5 border border-primary/10 inline-flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-xs">{profile.secFilings.recent8K.length}</Badge>
                                        <span className="text-xs font-medium text-primary/80">Filings Detected</span>
                                    </div>
                                </div>
                            </div>
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
                        </CardContent>
                    </Card>

                    {/* Litigation */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                    <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                </div>
                                Litigation & Legal Disputes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {profile.litigation.material.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 mb-2">Material Litigation</p>
                                    <ul className="space-y-1.5">
                                        {profile.litigation.material.map((item, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-amber-500/40 pl-3 py-0.5 text-foreground/90">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {profile.litigation.ongoing.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Ongoing Cases</p>
                                    <ul className="space-y-1.5">
                                        {profile.litigation.ongoing.map((item, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-blue-500/30 pl-3 py-0.5 text-foreground/90">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Corporate Governance */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                                    <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                </div>
                                Corporate Governance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted/20 p-4 rounded-lg border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Board Structure</p>
                                <p className="text-sm text-foreground/90 leading-relaxed">{profile.governance.boardStructure}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Key Committees</p>
                                <div className="flex flex-wrap gap-2">
                                    {profile.governance.keyCommittees.map((committee, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">{committee}</Badge>
                                    ))}
                                </div>
                            </div>
                            {profile.governance.policies.length > 0 && (
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

                    {/* Material Contracts */}
                    {profile.materialContracts.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                                        <Briefcase className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    Material Contracts
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
                    )}

                    {/* Regulatory Matters */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                    <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Regulatory Matters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {profile.regulatoryMatters.compliance.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">Compliance Framework</p>
                                    <ul className="space-y-1.5">
                                        {profile.regulatoryMatters.compliance.map((item, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-emerald-500/40 pl-3 py-0.5 text-foreground/90">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {profile.regulatoryMatters.investigations.length > 0 && (
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
                        </CardContent>
                    </Card>

                    {/* Ownership */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-teal-500/10 flex items-center justify-center">
                                    <DollarSign className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                </div>
                                Ownership Structure
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-muted/20 p-3 rounded-lg border text-center">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Insider Ownership</p>
                                    <p className="text-lg font-bold font-mono">{profile.ownership.insiderOwnership}</p>
                                </div>
                                <div className="bg-muted/20 p-3 rounded-lg border text-center">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Institutional Ownership</p>
                                    <p className="text-lg font-bold font-mono">{profile.ownership.institutionalOwnership}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2">Major Shareholders</p>
                                <ul className="space-y-1.5">
                                    {profile.ownership.majorShareholders.map((holder, i) => (
                                        <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-teal-500/30 pl-3 py-0.5 text-foreground/90">{holder}</li>
                                    ))}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Legal Risks */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                </div>
                                Legal Risk Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {profile.legalRisks.high.length > 0 && (
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
                            {profile.legalRisks.medium.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 mb-2">Medium Risk</p>
                                    <ul className="space-y-1.5">
                                        {profile.legalRisks.medium.map((risk, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2 border-l-2 border-amber-500/40 pl-3 py-0.5 text-foreground/90">{risk}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button onClick={resetSearch} variant="outline" className="gap-2">
                        <Search className="h-4 w-4" />
                        New Search
                    </Button>
                </div>
            )}
        </ToolPageLayout>
    )
}
