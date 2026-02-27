"use client"

import * as React from "react"
import { ArrowLeft, Loader2, FileText, Download, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"

interface ClientAlertResult {
    title: string
    summary: string
    fullText: string
    keyTakeaways: string[]
    affectedIndustries: string[]
    recommendedActions: string[]
}

const ALERT_TYPES = [
    { id: 'legislation', name: 'New Legislation', description: 'Updates on new laws and statutes' },
    { id: 'regulation', name: 'Regulatory Change', description: 'New or updated regulations' },
    { id: 'case-law', name: 'Case Law Update', description: 'Important court decisions' },
    { id: 'compliance', name: 'Compliance Alert', description: 'Compliance requirements and deadlines' },
    { id: 'industry', name: 'Industry Development', description: 'Industry-specific legal changes' },
    { id: 'advisory', name: 'Legal Advisory', description: 'General legal guidance and best practices' },
]

export default function ClientAlert() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatId = searchParams.get('chatId')

    const [alertType, setAlertType] = React.useState("")
    const [topic, setTopic] = React.useState("")
    const [context, setContext] = React.useState("")
    const [targetAudience, setTargetAudience] = React.useState("")
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [result, setResult] = React.useState<ClientAlertResult | null>(null)

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
                            setResult(parsedData)
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
        if (!alertType || !topic) {
            toast.error("Please select alert type and provide a topic")
            return
        }

        setIsGenerating(true)

        try {
            const response = await fetch('/api/templates/client-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertType,
                    topic,
                    context,
                    targetAudience
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate client alert')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Client alert generated successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to generate client alert"
            toast.error(message)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownload = () => {
        if (!result) return

        const content = `${result.title}\n\n${result.summary}\n\n${result.fullText}\n\nKey Takeaways:\n${result.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nRecommended Actions:\n${result.recommendedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`

        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `client_alert_${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("Client alert downloaded")
    }

    const resetAlert = () => {
        setAlertType("")
        setTopic("")
        setContext("")
        setTargetAudience("")
        setResult(null)
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 pb-32">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/templates')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Draft a Client Alert</h1>
                            <p className="text-muted-foreground">Generate professional client alerts about legal developments</p>
                        </div>
                    </div>

                    {!result ? (
                        /* Configuration Section */
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Alert Type */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Alert Type</CardTitle>
                                    <CardDescription>Select the type of client alert</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Select value={alertType} onValueChange={setAlertType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select alert type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ALERT_TYPES.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{type.name}</span>
                                                        <span className="text-xs text-muted-foreground">{type.description}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>

                            {/* Topic */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Topic</CardTitle>
                                    <CardDescription>Main subject of the alert</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Input
                                        placeholder="e.g., 'New SEC Cybersecurity Disclosure Rules', 'GDPR Enforcement Update'"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                    />
                                </CardContent>
                            </Card>

                            {/* Context */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Context & Details</CardTitle>
                                    <CardDescription>Background information and key details</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Provide background, key facts, dates, parties involved, or specific provisions..."
                                        value={context}
                                        onChange={(e) => setContext(e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                </CardContent>
                            </Card>

                            {/* Target Audience */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Target Audience (Optional)</CardTitle>
                                    <CardDescription>Who should receive this alert</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Input
                                        placeholder="e.g., 'Technology companies', 'Financial services clients', 'Healthcare providers'"
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value)}
                                    />
                                </CardContent>
                            </Card>

                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                size="lg"
                                className="w-full gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Generating Alert...
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-4 w-4" />
                                        Generate Client Alert
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        /* Generated Alert */
                        <div className="space-y-6">
                            {/* Title */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-2xl">{result.title}</CardTitle>
                                    <CardDescription className="text-base mt-2">{result.summary}</CardDescription>
                                </CardHeader>
                            </Card>

                            {/* Full Alert Text */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Full Alert
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="prose prose-sm max-w-none">
                                        <div className="whitespace-pre-wrap leading-relaxed">{result.fullText}</div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Key Takeaways */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Key Takeaways</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.keyTakeaways.map((takeaway, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                                                <span>{takeaway}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* Affected Industries */}
                            {result.affectedIndustries.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Affected Industries</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {result.affectedIndustries.map((industry, i) => (
                                                <span key={i} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm">
                                                    {industry}
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recommended Actions */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recommended Actions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.recommendedActions.map((action, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="text-green-600 mt-0.5">→</span>
                                                <span>{action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex gap-4">
                                <Button onClick={handleDownload} className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Download Alert
                                </Button>
                                <Button onClick={resetAlert} variant="outline" className="gap-2">
                                    <FileText className="h-4 w-4" />
                                    Create New Alert
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
