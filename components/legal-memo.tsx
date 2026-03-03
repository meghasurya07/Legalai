"use client"

import * as React from "react"
import { Loader2, FileText, Download, BookOpen, Gavel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { downloadTextFile } from "@/lib/download"

interface LegalMemoResult {
    heading: {
        to: string
        from: string
        date: string
        re: string
    }
    question: string
    briefAnswer: string
    facts: string
    analysis: string
    conclusion: string
    authorities: string[]
}

export default function LegalMemo() {
    const [legalQuestion, setLegalQuestion] = React.useState("")
    const [facts, setFacts] = React.useState("")
    const [jurisdiction, setJurisdiction] = React.useState("")
    const [to, setTo] = React.useState("")
    const [from, setFrom] = React.useState("")
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [result, setResult] = React.useState<LegalMemoResult | null>(null)

    const handleGenerate = async () => {
        if (!legalQuestion) {
            toast.error("Please provide a legal question")
            return
        }

        setIsGenerating(true)

        try {
            const response = await fetch('/api/templates/legal-memo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    legalQuestion,
                    facts,
                    jurisdiction,
                    to,
                    from
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate legal memo')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Legal memo generated successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to generate legal memo"
            toast.error(message)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownload = () => {
        if (!result) return

        const content = `MEMORANDUM

TO: ${result.heading.to}
FROM: ${result.heading.from}
DATE: ${result.heading.date}
RE: ${result.heading.re}

QUESTION PRESENTED

${result.question}

BRIEF ANSWER

${result.briefAnswer}

STATEMENT OF FACTS

${result.facts}

ANALYSIS

${result.analysis}

CONCLUSION

${result.conclusion}

AUTHORITIES

${result.authorities.join('\n')}
`
        downloadTextFile(content, `legal_memo_${Date.now()}.txt`)
    }

    const resetMemo = () => {
        setLegalQuestion("")
        setFacts("")
        setJurisdiction("")
        setTo("")
        setFrom("")
        setResult(null)
    }

    return (
        <ToolPageLayout
            title="Draft Memo from Legal Research"
            description="Generate comprehensive legal research memos"
            icon={<Gavel className="h-4 w-4" />}
            accentColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        >

            {!result ? (
                /* Configuration Section */
                <div className="space-y-5 max-w-3xl mx-auto">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Legal Question</CardTitle>
                            <CardDescription>The legal issue to be analyzed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="e.g., 'Can our client terminate the contract for material breach without liability?'"
                                value={legalQuestion}
                                onChange={(e) => setLegalQuestion(e.target.value)}
                                className="min-h-[80px]"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Facts</CardTitle>
                            <CardDescription>Relevant factual background</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Describe the relevant facts, parties, dates, events, and circumstances..."
                                value={facts}
                                onChange={(e) => setFacts(e.target.value)}
                                className="min-h-[120px]"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Jurisdiction (Optional)</CardTitle>
                            <CardDescription>Applicable jurisdiction</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="e.g., 'Federal (2nd Circuit)', 'California', 'New York'"
                                value={jurisdiction}
                                onChange={(e) => setJurisdiction(e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">To</CardTitle>
                                <CardDescription>Recipient</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input placeholder="e.g., 'Partner Name'" value={to} onChange={(e) => setTo(e.target.value)} />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">From</CardTitle>
                                <CardDescription>Author</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input placeholder="e.g., 'Associate Name'" value={from} onChange={(e) => setFrom(e.target.value)} />
                            </CardContent>
                        </Card>
                    </div>

                    <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="w-full gap-2">
                        {isGenerating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Generating Memo...</>
                        ) : (
                            <><BookOpen className="h-4 w-4" /> Generate Legal Memo</>
                        )}
                    </Button>
                </div>
            ) : (
                /* Generated Memo — Formal Document Style */
                <div className="space-y-5 max-w-4xl mx-auto">
                    {/* Memo Heading */}
                    <Card className="overflow-hidden">
                        <div className="bg-muted/50 px-6 py-4 border-b">
                            <h2 className="text-center text-lg font-bold tracking-widest uppercase">Memorandum</h2>
                        </div>
                        <CardContent className="p-6 space-y-1.5">
                            <div className="grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-sm">
                                <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wide pt-0.5">To:</span>
                                <span className="font-medium">{result.heading.to}</span>
                                <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wide pt-0.5">From:</span>
                                <span className="font-medium">{result.heading.from}</span>
                                <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wide pt-0.5">Date:</span>
                                <span className="font-medium">{result.heading.date}</span>
                                <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wide pt-0.5">Re:</span>
                                <span className="font-medium">{result.heading.re}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Question Presented</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90">{result.question}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Brief Answer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/90 font-medium">{result.briefAnswer}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Statement of Facts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result.facts}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result.analysis}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Conclusion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">{result.conclusion}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Authorities Cited</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1.5">
                                {result.authorities.map((authority, i) => (
                                    <li key={i} className="text-sm italic text-foreground/80 pl-4 border-l-2 border-muted-foreground/20">{authority}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <div className="flex gap-3">
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Memo
                        </Button>
                        <Button onClick={resetMemo} variant="outline" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Create New Memo
                        </Button>
                    </div>
                </div>
            )}
        </ToolPageLayout>
    )
}
