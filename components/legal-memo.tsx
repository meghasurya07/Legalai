"use client"

import * as React from "react"
import { Loader2, FileText, Download, BookOpen } from "lucide-react"
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
        <ToolPageLayout title="Draft Memo from Legal Research" description="Generate comprehensive legal research memos">

            {!result ? (
                /* Configuration Section */
                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Legal Question */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Legal Question</CardTitle>
                            <CardDescription>The legal issue to be analyzed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="e.g., 'Can our client terminate the contract for material breach without liability?' or 'Is the non-compete clause enforceable under state law?'"
                                value={legalQuestion}
                                onChange={(e) => setLegalQuestion(e.target.value)}
                                className="min-h-[80px]"
                            />
                        </CardContent>
                    </Card>

                    {/* Facts */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Facts</CardTitle>
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

                    {/* Jurisdiction */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Jurisdiction (Optional)</CardTitle>
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

                    {/* Memo Header Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>To</CardTitle>
                                <CardDescription>Recipient</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="e.g., 'Partner Name' or 'File'"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>From</CardTitle>
                                <CardDescription>Author</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="e.g., 'Associate Name'"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        size="lg"
                        className="w-full gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating Memo...
                            </>
                        ) : (
                            <>
                                <BookOpen className="h-4 w-4" />
                                Generate Legal Memo
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                /* Generated Memo */
                <div className="space-y-6">
                    {/* Memo Heading */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-center mb-4">MEMORANDUM</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="font-semibold">TO:</span>
                                <span>{result.heading.to}</span>
                                <span className="font-semibold">FROM:</span>
                                <span>{result.heading.from}</span>
                                <span className="font-semibold">DATE:</span>
                                <span>{result.heading.date}</span>
                                <span className="font-semibold">RE:</span>
                                <span>{result.heading.re}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Question Presented */}
                    <Card>
                        <CardHeader>
                            <CardTitle>QUESTION PRESENTED</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed">{result.question}</p>
                        </CardContent>
                    </Card>

                    {/* Brief Answer */}
                    <Card>
                        <CardHeader>
                            <CardTitle>BRIEF ANSWER</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed">{result.briefAnswer}</p>
                        </CardContent>
                    </Card>

                    {/* Statement of Facts */}
                    <Card>
                        <CardHeader>
                            <CardTitle>STATEMENT OF FACTS</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.facts}</div>
                        </CardContent>
                    </Card>

                    {/* Analysis */}
                    <Card>
                        <CardHeader>
                            <CardTitle>ANALYSIS</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm max-w-none">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.analysis}</div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Conclusion */}
                    <Card>
                        <CardHeader>
                            <CardTitle>CONCLUSION</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.conclusion}</p>
                        </CardContent>
                    </Card>

                    {/* Authorities Cited */}
                    <Card>
                        <CardHeader>
                            <CardTitle>AUTHORITIES CITED</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1.5">
                                {result.authorities.map((authority, i) => (
                                    <li key={i} className="text-sm font-mono">{authority}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-4">
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
