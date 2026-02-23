"use client"

import * as React from "react"
import { Search, ArrowLeft, Loader2, Building2, Scale, FileText, AlertTriangle, Users, Shield, DollarSign, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"

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
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatId = searchParams.get('chatId')

    const [companyInput, setCompanyInput] = React.useState("")
    const [companyPrompt, setCompanyPrompt] = React.useState("")
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [profile, setProfile] = React.useState<LegalCompanyProfile | null>(null)

    // Load history if chatId is present
    React.useEffect(() => {
        if (!chatId) return

        const loadHistory = async () => {
            setIsGenerating(true)
            try {
                const res = await fetch(`/api/chat/conversations/${chatId}/messages`)
                if (res.ok) {
                    const messages = await res.json()
                    // Find the assistant message with the JSON result
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
            const response = await fetch('/api/workflows/company-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company: companyInput,
                    prompt: companyPrompt
                })
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
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/workflows')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Company Research Profile</h1>
                            <p className="text-muted-foreground">Legal due diligence and SEC filings analysis for public companies</p>
                        </div>
                    </div>

                    {!profile ? (
                        /* Search Section */
                        <Card className="max-w-2xl mx-auto">
                            <CardHeader>
                                <CardTitle>Search Company</CardTitle>
                                <CardDescription>Enter a company name or ticker for legal analysis (e.g., AAPL, Tesla, MSFT)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="company">Company Name or Ticker</Label>
                                        <Input
                                            id="company"
                                            placeholder="e.g., Apple, Tesla, MSFT..."
                                            value={companyInput}
                                            onChange={(e) => setCompanyInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    handleGenerate()
                                                }
                                            }}
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="prompt">Specific Focus (Optional)</Label>
                                        <Textarea
                                            id="prompt"
                                            placeholder="e.g., Focus on environmental litigation, ongoing SEC investigations, or specific board structure concerns..."
                                            value={companyPrompt}
                                            onChange={(e) => setCompanyPrompt(e.target.value)}
                                            className="min-h-[120px] resize-none focus-visible:ring-primary/20"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Adding a specific focus will tailor the legal analysis to your specific needs.
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="w-full h-11 text-base font-semibold transition-all hover:shadow-lg hover:shadow-primary/10"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Conducting Due Diligence...
                                            </>
                                        ) : (
                                            <>
                                                <Search className="mr-2 h-5 w-5" />
                                                Generate Profile
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Analysis Scope</h4>
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
                        /* Profile Section */
                        <div className="space-y-6">
                            {/* Company Header */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2">
                                            <CardTitle className="text-2xl">{profile.company.name}</CardTitle>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary">{profile.company.ticker}</Badge>
                                                <Badge variant="outline">CIK: {profile.company.cik}</Badge>
                                                <Separator orientation="vertical" className="h-4" />
                                                <span className="text-sm text-muted-foreground">{profile.company.industry}</span>
                                                <Separator orientation="vertical" className="h-4" />
                                                <span className="text-sm text-muted-foreground">Inc. {profile.company.incorporated}</span>
                                            </div>
                                        </div>
                                        <Building2 className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                            </Card>

                            {/* SEC Filings */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        SEC Filings Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-K</p>
                                            <p className="text-sm break-all font-mono text-muted-foreground/80 leading-relaxed bg-muted/20 p-2 rounded-lg border border-border/40 truncate hover:whitespace-normal cursor-help">
                                                {profile.secFilings.recent10K}
                                            </p>
                                        </div>
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Most Recent 10-Q</p>
                                            <p className="text-sm break-all font-mono text-muted-foreground/80 leading-relaxed bg-muted/20 p-2 rounded-lg border border-border/40 truncate hover:whitespace-normal cursor-help">
                                                {profile.secFilings.recent10Q}
                                            </p>
                                        </div>
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent 8-Ks</p>
                                            <div className="p-2 rounded-lg bg-primary/5 border border-primary/10 inline-flex items-center gap-2">
                                                <Badge variant="outline" className="font-mono text-xs">{profile.secFilings.recent8K.length}</Badge>
                                                <span className="text-xs font-semibold text-primary/80">Filings Detected</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <span className="h-1 w-1 rounded-full bg-primary" />
                                            Key Highlights from Filings
                                        </div>
                                        <ul className="space-y-2.5">
                                            {profile.secFilings.keyHighlights.map((highlight, i) => (
                                                <li key={i} className="text-sm flex items-start gap-3 text-muted-foreground leading-relaxed group">
                                                    <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                                                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                                                    </div>
                                                    <span className="break-words">{highlight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Litigation */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Scale className="h-5 w-5" />
                                        Litigation & Legal Disputes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {profile.litigation.material.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-amber-600">Material Litigation:</p>
                                            <ul className="space-y-1.5">
                                                {profile.litigation.material.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="break-words leading-relaxed text-muted-foreground/90">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {profile.litigation.ongoing.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2">Ongoing Cases:</p>
                                            <ul className="space-y-1.5">
                                                {profile.litigation.ongoing.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                                                        <span className="break-words leading-relaxed">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Corporate Governance */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Corporate Governance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="bg-muted/10 p-4 rounded-xl border border-border/40">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Board Structure</p>
                                        <p className="text-sm text-muted-foreground/90 leading-relaxed break-words">{profile.governance.boardStructure}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-2">Key Committees:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.governance.keyCommittees.map((committee, i) => (
                                                <Badge key={i} variant="secondary">{committee}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    {profile.governance.policies.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2">Governance Policies:</p>
                                            <ul className="space-y-1">
                                                {profile.governance.policies.map((policy, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <Shield className="h-4 w-4 text-green-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="break-words leading-relaxed text-muted-foreground/90">{policy}</span>
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
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Briefcase className="h-5 w-5" />
                                            Material Contracts
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {profile.materialContracts.map((contract, i) => (
                                                <li key={i} className="text-sm flex items-start gap-3 group border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                                    <FileText className="h-4 w-4 text-purple-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                                    <span className="break-words leading-relaxed text-muted-foreground/90 font-medium">{contract}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Regulatory Matters */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="h-5 w-5" />
                                        Regulatory Matters
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {profile.regulatoryMatters.compliance.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2">Compliance Framework:</p>
                                            <ul className="space-y-1">
                                                {profile.regulatoryMatters.compliance.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <div className="h-4 w-4 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                            <span className="text-[10px] text-green-600 font-bold">✓</span>
                                                        </div>
                                                        <span className="break-words leading-relaxed text-muted-foreground/90">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {profile.regulatoryMatters.investigations.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-amber-600">Investigations:</p>
                                            <ul className="space-y-1">
                                                {profile.regulatoryMatters.investigations.map((item, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="break-words leading-relaxed text-muted-foreground/90">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Ownership */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <DollarSign className="h-5 w-5" />
                                        Ownership Structure
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Insider Ownership</p>
                                            <p className="text-lg font-semibold">{profile.ownership.insiderOwnership}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Institutional Ownership</p>
                                            <p className="text-lg font-semibold">{profile.ownership.institutionalOwnership}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-2">Major Shareholders:</p>
                                        <ul className="space-y-1">
                                            {profile.ownership.majorShareholders.map((holder, i) => (
                                                <li key={i} className="text-sm flex items-start gap-3 group">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                                                    <span className="break-words leading-relaxed text-muted-foreground/90">{holder}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Legal Risks */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        Legal Risk Assessment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {profile.legalRisks.high.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-red-600">High Risk:</p>
                                            <ul className="space-y-1.5">
                                                {profile.legalRisks.high.map((risk, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <AlertTriangle className="h-4 w-4 text-red-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="break-words leading-relaxed text-red-700/80 font-medium">{risk}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {profile.legalRisks.medium.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium mb-2 text-amber-600">Medium Risk:</p>
                                            <ul className="space-y-1.5">
                                                {profile.legalRisks.medium.map((risk, i) => (
                                                    <li key={i} className="text-sm flex items-start gap-3 group">
                                                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="break-words leading-relaxed text-amber-700/80 font-medium">{risk}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-8">
                        {profile && (
                            <Button onClick={resetSearch} variant="outline" className="gap-2">
                                <Search className="h-4 w-4" />
                                New Search
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
