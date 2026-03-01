"use client"

import * as React from "react"
import { Loader2, FileText, Download, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/ui/duplicate-file-modal"
import { ToolPageLayout } from "@/components/ui/tool-page-layout"
import { FileUploadZone } from "@/components/ui/file-upload-zone"
import { downloadTextFile } from "@/lib/download"

interface TranslationResult {
    originalLanguage: string
    targetLanguage: string
    translatedText: string
    preservedTerms: string[]
    notes: string[]
}

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'da', name: 'Danish' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
]

export default function Translation() {
    const [documentFile, setDocumentFile] = React.useState<File | null>(null)
    const [targetLanguage, setTargetLanguage] = React.useState("")
    const [isTranslating, setIsTranslating] = React.useState(false)
    const [result, setResult] = React.useState<TranslationResult | null>(null)
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)

    const handleFileSelect = (file: File) => {
        if (documentFile && documentFile.name === file.name) {
            setIsDuplicateModalOpen(true)
            return
        }
        setDocumentFile(file)
        toast.success("Document uploaded")
    }

    const handleTranslate = async () => {
        if (!documentFile) {
            toast.error("Please upload a document")
            return
        }

        if (!targetLanguage) {
            toast.error("Please select a target language")
            return
        }

        setIsTranslating(true)
        const formData = new FormData()
        formData.append('document', documentFile)
        formData.append('targetLanguage', targetLanguage)

        try {
            const response = await fetch('/api/templates/translation', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to translate document')
            }

            const data = await response.json()
            setResult(data)
            toast.success("Document translated successfully!")
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Failed to translate document"
            toast.error(message)
        } finally {
            setIsTranslating(false)
        }
    }

    const handleDownload = () => {
        if (!result) return
        downloadTextFile(result.translatedText, `translated_${documentFile?.name || 'document'}.txt`)
    }

    const resetTranslation = () => {
        setDocumentFile(null)
        setTargetLanguage("")
        setResult(null)
    }

    return (
        <ToolPageLayout title="Translation" description="Translate legal documents while preserving legal terminology">

            {!result ? (
                /* Upload & Configure Section */
                <div className="space-y-6 max-w-2xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Document</CardTitle>
                            <CardDescription>Upload the document you want to translate</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FileUploadZone id="document" file={documentFile} onFileSelect={handleFileSelect} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Target Language</CardTitle>
                            <CardDescription>Select the language to translate to</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select target language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map((lang) => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Button
                        onClick={handleTranslate}
                        disabled={!documentFile || !targetLanguage || isTranslating}
                        size="lg"
                        className="w-full gap-2"
                    >
                        {isTranslating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Translating...
                            </>
                        ) : (
                            <>
                                <Languages className="h-4 w-4" />
                                Translate Document
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                /* Translation Results */
                <div className="space-y-6">
                    {/* Translation Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Languages className="h-5 w-5" />
                                Translation Complete
                            </CardTitle>
                            <CardDescription>
                                Translated from {LANGUAGES.find(l => l.code === result.originalLanguage)?.name || result.originalLanguage} to {LANGUAGES.find(l => l.code === result.targetLanguage)?.name || result.targetLanguage}
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {/* Translated Text */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Translated Document</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-auto">
                                <pre className="text-sm whitespace-pre-wrap font-sans">{result.translatedText}</pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preserved Legal Terms */}
                    {result.preservedTerms.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Preserved Legal Terms</CardTitle>
                                <CardDescription>Technical legal terms kept in original language</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {result.preservedTerms.map((term, i) => (
                                        <span key={i} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm font-mono">
                                            {term}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Translation Notes */}
                    {result.notes.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Translation Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {result.notes.map((note, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span>{note}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Translation
                        </Button>
                        <Button onClick={resetTranslation} variant="outline" className="gap-2">
                            <FileText className="h-4 w-4" />
                            New Translation
                        </Button>
                    </div>
                </div>
            )}
            {/* Duplicate File Warning */}
            <DuplicateFileModal
                isOpen={isDuplicateModalOpen}
                onOpenChange={setIsDuplicateModalOpen}
            />
        </ToolPageLayout>
    )
}
