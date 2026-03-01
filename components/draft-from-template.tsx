"use client"

import * as React from "react"
import { Loader2, FileText, Download, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { downloadTextFile } from "@/lib/download"

interface TemplateField {
    name: string
    value: string
}

interface DraftResult {
    documentText: string
    templateUsed: string
    fieldsPopulated: number
}

const TEMPLATES = [
    { id: 'nda', name: 'Non-Disclosure Agreement (NDA)', description: 'Mutual or unilateral confidentiality agreement' },
    { id: 'employment', name: 'Employment Agreement', description: 'Standard employment contract' },
    { id: 'service', name: 'Service Agreement', description: 'Professional services contract' },
    { id: 'lease', name: 'Lease Agreement', description: 'Commercial or residential lease' },
    { id: 'sow', name: 'Statement of Work (SOW)', description: 'Project scope and deliverables' },
    { id: 'amendment', name: 'Contract Amendment', description: 'Modify existing agreement' },
    { id: 'termination', name: 'Termination Letter', description: 'Contract termination notice' },
    { id: 'demand', name: 'Demand Letter', description: 'Legal demand for action or payment' },
]

export default function DraftFromTemplate() {
    const [selectedTemplate, setSelectedTemplate] = React.useState("")
    const [fields, setFields] = React.useState<TemplateField[]>([{ name: '', value: '' }])
    const [additionalInstructions, setAdditionalInstructions] = React.useState("")
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [result, setResult] = React.useState<DraftResult | null>(null)

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId)
        // Reset fields when template changes
        setFields([{ name: '', value: '' }])
    }

    const addField = () => {
        setFields([...fields, { name: '', value: '' }])
    }

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index))
    }

    const updateField = (index: number, key: 'name' | 'value', value: string) => {
        const newFields = [...fields]
        newFields[index][key] = value
        setFields(newFields)
    }

    const handleGenerate = async () => {
        if (!selectedTemplate) {
            toast.error("Please select a template")
            return
        }

        const validFields = fields.filter(f => f.name && f.value)
        if (validFields.length === 0) {
            toast.error("Please add at least one field")
            return
        }

        setIsGenerating(true)

        try {
            const response = await fetch('/api/templates/draft-from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template: selectedTemplate,
                    fields: validFields,
                    additionalInstructions
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate document')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Document generated successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to generate document"
            toast.error(message)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownload = () => {
        if (!result) return
        downloadTextFile(result.documentText, `${selectedTemplate}_${Date.now()}.txt`)
    }

    const resetDraft = () => {
        setSelectedTemplate("")
        setFields([{ name: '', value: '' }])
        setAdditionalInstructions("")
        setResult(null)
    }

    return (
        <ToolPageLayout title="Draft from Template" description="Generate legal documents from predefined templates">

            {!result ? (
                /* Configuration Section */
                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Template Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Template</CardTitle>
                            <CardDescription>Choose a legal document template</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TEMPLATES.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{template.name}</span>
                                                <span className="text-xs text-muted-foreground">{template.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Template Fields */}
                    {selectedTemplate && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Template Variables</CardTitle>
                                <CardDescription>Fill in the details for your document</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={index} className="flex gap-2">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                placeholder="Field name (e.g., 'Company Name', 'Effective Date')"
                                                value={field.name}
                                                onChange={(e) => updateField(index, 'name', e.target.value)}
                                            />
                                            <Input
                                                placeholder="Field value"
                                                value={field.value}
                                                onChange={(e) => updateField(index, 'value', e.target.value)}
                                            />
                                        </div>
                                        {fields.length > 1 && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => removeField(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button onClick={addField} variant="outline" className="w-full gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add Field
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Additional Instructions */}
                    {selectedTemplate && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Additional Instructions (Optional)</CardTitle>
                                <CardDescription>Specify any custom requirements or modifications</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    placeholder="e.g., 'Include a non-compete clause', 'Add termination provisions for breach'"
                                    value={additionalInstructions}
                                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {selectedTemplate && (
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            size="lg"
                            className="w-full gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating Document...
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4" />
                                    Generate Document
                                </>
                            )}
                        </Button>
                    )}
                </div>
            ) : (
                /* Generated Document */
                <div className="space-y-6">
                    {/* Document Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Document Generated
                            </CardTitle>
                            <CardDescription>
                                Template: {TEMPLATES.find(t => t.id === result.templateUsed)?.name} • {result.fieldsPopulated} fields populated
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {/* Generated Text */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Generated Document</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted rounded-lg p-6 max-h-[600px] overflow-auto">
                                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{result.documentText}</pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Document
                        </Button>
                        <Button onClick={resetDraft} variant="outline" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Create New Document
                        </Button>
                    </div>
                </div>
            )}
        </ToolPageLayout>
    )
}
