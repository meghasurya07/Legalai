"use client"

import * as React from "react"
import { Loader2, FileText, Download, Languages, ArrowRight, Info, RotateCcw, AlertTriangle, Copy, Check, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { DuplicateFileModal } from "@/components/documents/duplicate-file-modal"
import { ToolPageLayout } from "@/components/templates/tool-page-layout"
import { FileUploadZone } from "@/components/documents/file-upload-zone"
import { downloadTextFile } from "@/lib/download"
import { useTemplateWorkflow } from "@/components/templates/use-template-workflow"
import { TemplateResultHeader } from "@/components/templates/template-result-header"
import { TemplateProcessing } from "@/components/templates/template-processing"

interface TranslationResult {
    originalLanguage: string
    targetLanguage: string
    translatedText: string
    preservedTerms: string[]
    notes: string[]
}

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'zh', name: 'Chinese (Simplified)', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
]

// RTL languages
const RTL_LANGUAGES = new Set(['ar', 'he'])

// ─── Section Copy ────────────────────────────────────────
function SectionCopy({ content }: { content: string }) {
    const [copied, setCopied] = React.useState(false)
    const handleCopy = async () => {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        toast.success("Copied")
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </Button>
    )
}

// ─── Markdown Export ─────────────────────────────────────
function formatTranslationAsMarkdown(r: TranslationResult): string {
    const srcLang = LANGUAGES.find(l => l.code === r.originalLanguage)?.name || r.originalLanguage
    const tgtLang = LANGUAGES.find(l => l.code === r.targetLanguage)?.name || r.targetLanguage
    let md = `# Legal Document Translation\n\n`
    md += `**Source Language:** ${srcLang}\n**Target Language:** ${tgtLang}\n\n`
    md += `## Translated Text\n\n${r.translatedText}\n\n`
    if (r.preservedTerms?.length) { md += `## Preserved Legal Terms\n`; r.preservedTerms.forEach(t => { md += `- ${t}\n` }); md += '\n' }
    if (r.notes?.length) { md += `## Translation Notes\n`; r.notes.forEach((n, i) => { md += `${i + 1}. ${n}\n` }) }
    return md
}

// ─── Processing steps ────────────────────────────────────
const PROCESSING_STEPS = [
    { label: "Uploading document", detail: "Preparing file for translation..." },
    { label: "Detecting source language", detail: "Identifying the document's language..." },
    { label: "Translating document", detail: "Preserving legal terminology and meaning..." },
]

// ─── Main Component ──────────────────────────────────────
export default function Translation() {
    const {
        file: documentFile,
        handleFileSelect,
        isDuplicateModalOpen, setIsDuplicateModalOpen,
        isRunning: isTranslating,
        result,
        runWithFile,
        reset,
        error,
        retry,
        generatedAt,
        processingStep,
        elapsedSeconds,
    } = useTemplateWorkflow<TranslationResult>({
        apiEndpoint: '/api/templates/translation',
    })

    const [targetLanguage, setTargetLanguage] = React.useState("")

    const handleTranslate = async () => {
        if (!documentFile) { toast.error("Please upload a document"); return }
        if (!targetLanguage) { toast.error("Please select a target language"); return }

        const formData = new FormData()
        // FIX: Use 'file' field name to match the API route's fileField config
        formData.append('file', documentFile)
        formData.append('targetLanguage', targetLanguage)
        await runWithFile(formData, "Document translated successfully!")
    }

    const handleDownload = () => {
        if (!result) return
        downloadTextFile(result.translatedText, `translated_${documentFile?.name || 'document'}.txt`)
    }

    const resetTranslation = () => {
        setTargetLanguage("")
        reset()
    }

    // Determine if the target language is RTL
    const isTargetRTL = result ? RTL_LANGUAGES.has(result.targetLanguage) : false

    const selectedLang = LANGUAGES.find(l => l.code === targetLanguage)

    return (
        <ToolPageLayout
            title="Legal Translation"
            description="Translate legal documents while preserving legal terminology and meaning"
            icon={<Languages className="h-4 w-4" />}
            accentColor="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        >
            {isTranslating ? (
                <TemplateProcessing
                    steps={PROCESSING_STEPS}
                    activeStep={processingStep}
                    elapsedSeconds={elapsedSeconds}
                    accentColor="text-rose-600 dark:text-rose-400"
                />
            ) : error && !result ? (
                <div className="max-w-md mx-auto text-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">Translation Failed</h3>
                    <p className="text-sm text-muted-foreground mb-6">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <Button onClick={retry} variant="default" className="gap-2"><RotateCcw className="h-4 w-4" /> Retry</Button>
                        <Button onClick={resetTranslation} variant="outline">Start Over</Button>
                    </div>
                </div>
            ) : !result ? (
                <div className="space-y-5 max-w-2xl mx-auto">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Upload Document</CardTitle>
                            <CardDescription>Upload the legal document you want to translate</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <FileUploadZone id="document" file={documentFile} onFileSelect={handleFileSelect} />
                            {documentFile && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <p className="text-xs font-medium truncate flex-1">{documentFile.name}</p>
                                    <span className="text-[10px] text-muted-foreground">{(documentFile.size / 1024).toFixed(1)} KB</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Globe className="h-4 w-4 text-rose-500" />
                                Target Language
                            </CardTitle>
                            <CardDescription>Select the language to translate your document into</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select target language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map((lang) => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            <span className="flex items-center gap-2">
                                                <span>{lang.flag}</span>
                                                <span>{lang.name}</span>
                                                {RTL_LANGUAGES.has(lang.code) && (
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">RTL</Badge>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedLang && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                    <span className="text-lg">{selectedLang.flag}</span>
                                    <span className="text-sm font-medium">Translating to {selectedLang.name}</span>
                                    {RTL_LANGUAGES.has(selectedLang.code) && (
                                        <Badge variant="outline" className="text-[10px] ml-auto">Right-to-Left</Badge>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button onClick={handleTranslate} disabled={!documentFile || !targetLanguage || isTranslating} size="lg" className="w-full gap-2">
                        {isTranslating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Translating...</>
                        ) : (
                            <><Languages className="h-4 w-4" /> Translate Document</>
                        )}
                    </Button>

                    {/* Disclaimer */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                AI-powered translation optimized for legal terminology. Not a substitute for certified legal translation. Always have translations reviewed by a qualified legal translator for official use.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <TemplateResultHeader
                        title="Translation Complete"
                        icon={<Languages className="h-3.5 w-3.5" />}
                        accentColor="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        generatedAt={generatedAt || undefined}
                        onReset={resetTranslation}
                        resetLabel="New Translation"
                        copyContent={result.translatedText}
                        downloadContent={formatTranslationAsMarkdown(result)}
                        downloadFilename={`translation-${result.targetLanguage}-${new Date().toISOString().split('T')[0]}.md`}
                    />

                    {/* Translation Info */}
                    <Card className="overflow-hidden">
                        <div className="bg-rose-500/5 px-6 py-4 border-b">
                            <div className="flex items-center gap-3">
                                <Languages className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                                <span className="text-sm font-semibold">Translation Complete</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs gap-1">
                                    <span>{LANGUAGES.find(l => l.code === result.originalLanguage)?.flag || '🌐'}</span>
                                    {LANGUAGES.find(l => l.code === result.originalLanguage)?.name || result.originalLanguage}
                                </Badge>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <Badge variant="secondary" className="text-xs gap-1">
                                    <span>{LANGUAGES.find(l => l.code === result.targetLanguage)?.flag || '🌐'}</span>
                                    {LANGUAGES.find(l => l.code === result.targetLanguage)?.name || result.targetLanguage}
                                </Badge>
                            </div>
                        </div>
                    </Card>

                    {/* Translated Text */}
                    <div className="group/section">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="h-7 w-7 rounded-md bg-rose-500/10 flex items-center justify-center">
                                        <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    Translated Document
                                    <div className="ml-auto"><SectionCopy content={result.translatedText} /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-muted/30 rounded-lg p-5 max-h-[500px] overflow-auto border">
                                    <pre
                                        className="text-sm whitespace-pre-wrap font-sans leading-relaxed"
                                        dir={isTargetRTL ? 'rtl' : 'ltr'}
                                        style={isTargetRTL ? { textAlign: 'right' } : undefined}
                                    >
                                        {result.translatedText}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preserved Legal Terms */}
                    {result.preservedTerms?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                                            <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        Preserved Legal Terms
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.preservedTerms.length}</Badge>
                                        <SectionCopy content={result.preservedTerms.join(', ')} />
                                    </CardTitle>
                                    <CardDescription className="ml-9">Technical legal terms kept in original language for accuracy</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {result.preservedTerms.map((term, i) => (
                                            <Badge key={i} variant="outline" className="text-xs font-mono px-2.5 py-1">{term}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Translation Notes */}
                    {result.notes?.length > 0 && (
                        <div className="group/section">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                                            <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        Translation Notes
                                        <Badge variant="secondary" className="ml-auto text-[10px]">{result.notes.length}</Badge>
                                        <SectionCopy content={result.notes.join('\n')} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {result.notes.map((note, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm">
                                                <span className="h-5 w-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">{i + 1}</span>
                                                <span className="text-foreground/90 leading-relaxed">{note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Download */}
                    <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Translation
                        </Button>
                    </div>
                </div>
            )}
            <DuplicateFileModal isOpen={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen} />
        </ToolPageLayout>
    )
}
