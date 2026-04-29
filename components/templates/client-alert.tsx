"use client"

import * as React from "react"
import { Loader2, FileText, Download, AlertCircle, Bell, CheckCircle2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"

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
    const {
        isRunning: isGenerating,
        result,
        runWithJson,
        reset,
    } = useTemplateWorkflow<ClientAlertResult>({
        apiEndpoint: '/api/templates/client-alert',
    })

    const [alertType, setAlertType] = React.useState("")
    const [topic, setTopic] = React.useState("")
    const [context, setContext] = React.useState("")
    const [targetAudience, setTargetAudience] = React.useState("")

    const handleGenerate = async () => {
        if (!alertType || !topic) {
            toast.error("Please select alert type and provide a topic")
            return
        }
        await runWithJson(
            { alertType, topic, context, targetAudience },
            "Client alert generated successfully!"
        )
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
        reset()
    }

    return (
        <ToolPageLayout
            title="Draft a Client Alert"
            description="Generate professional client alerts about legal developments"
            icon={<Bell className="h-4 w-4" />}
            accentColor="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
        >

            {!result ? (
                <div className="space-y-5 max-w-3xl mx-auto">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Alert Type</CardTitle>
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

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Topic</CardTitle>
                            <CardDescription>Main subject of the alert</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input placeholder="e.g., 'New SEC Cybersecurity Disclosure Rules'" value={topic} onChange={(e) => setTopic(e.target.value)} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Context & Details</CardTitle>
                            <CardDescription>Background information and key details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea placeholder="Provide background, key facts, dates, parties involved..." value={context} onChange={(e) => setContext(e.target.value)} className="min-h-[120px]" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Target Audience (Optional)</CardTitle>
                            <CardDescription>Who should receive this alert</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input placeholder="e.g., 'Technology companies', 'Healthcare providers'" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
                        </CardContent>
                    </Card>

                    <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="w-full gap-2">
                        {isGenerating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Generating Alert...</>
                        ) : (
                            <><AlertCircle className="h-4 w-4" /> Generate Client Alert</>
                        )}
                    </Button>
                </div>
            ) : (
                /* Generated Alert */
                <div className="space-y-5 max-w-4xl mx-auto">
                    {/* Title & Summary */}
                    <Card className="overflow-hidden">
                        <div className="bg-fuchsia-500/5 px-6 py-4 border-b">
                            <h2 className="text-xl font-bold tracking-tight">{result.title}</h2>
                        </div>
                        <CardContent className="p-6">
                            <p className="text-sm leading-relaxed text-foreground/90 font-medium">{result.summary}</p>
                        </CardContent>
                    </Card>

                    {/* Full Alert Text */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-fuchsia-500/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                                </div>
                                Full Alert
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{result.fullText}</div>
                        </CardContent>
                    </Card>

                    {/* Key Takeaways */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Key Takeaways</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2.5">
                                {result.keyTakeaways.map((takeaway, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">{i + 1}</span>
                                        <span className="text-foreground/90">{takeaway}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Affected Industries */}
                    {result.affectedIndustries.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-slate-500/10 flex items-center justify-center">
                                        <Building2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    Affected Industries
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {result.affectedIndustries.map((industry, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs px-2.5 py-1">{industry}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommended Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Recommended Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {result.recommendedActions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <span className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                        </span>
                                        <span className="text-foreground/90">{action}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <div className="flex gap-3">
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
        </ToolPageLayout>
    )
}

