"use client"

import { useState } from "react"
import { Project } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, FileText, CheckSquare, Square, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface CrossReferenceToolbarProps {
    project: Project
    anchorDocumentId: string
    setAnchorDocumentId: (id: string) => void
    targetDocumentIds: string[]
    setTargetDocumentIds: (ids: string[]) => void
    prompt: string
    setPrompt: (v: string) => void
    onAnalyze: () => void
    isAnalyzing: boolean
}

export function CrossReferenceToolbar({
    project,
    anchorDocumentId,
    setAnchorDocumentId,
    targetDocumentIds,
    setTargetDocumentIds,
    prompt,
    setPrompt,
    onAnalyze,
    isAnalyzing
}: CrossReferenceToolbarProps) {
    const validFiles = project.files.filter(f => f.extracted_text)
    const [anchorSearch, setAnchorSearch] = useState("")
    const [targetSearch, setTargetSearch] = useState("")

    const filteredAnchorFiles = validFiles.filter(f => f.name.toLowerCase().includes(anchorSearch.toLowerCase()))
    const filteredTargetFiles = validFiles.filter(f => f.id !== anchorDocumentId && f.name.toLowerCase().includes(targetSearch.toLowerCase()))

    const toggleTarget = (id: string) => {
        if (targetDocumentIds.includes(id)) {
            setTargetDocumentIds(targetDocumentIds.filter(t => t !== id))
        } else {
            setTargetDocumentIds([...targetDocumentIds, id])
        }
    }

    const selectAllTargets = () => {
        const idsToAdd = filteredTargetFiles.map(f => f.id)
        const newSet = new Set([...targetDocumentIds, ...idsToAdd])
        setTargetDocumentIds(Array.from(newSet))
    }

    return (
        <div className="flex flex-col border-b bg-muted/30 shrink-0">
            <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="text-primary text-xl">⚖️</span>
                            Cross-Reference Analysis
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Compare clauses across documents to detect deviations or contradictions.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {/* Anchor Document Selector */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-1/3">
                        <label className="text-xs font-semibold text-muted-foreground">ANCHOR DOCUMENT (THE STANDARD)</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal text-left h-9 overflow-hidden">
                                    <FileText className="mr-2 h-4 w-4 shrink-0 text-amber-500" />
                                    <span className="truncate">
                                        {anchorDocumentId ? project.files.find(f => f.id === anchorDocumentId)?.name : "Select anchor document..."}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <div className="p-2 border-b bg-background z-10">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search documents..."
                                            className="pl-8 h-9 text-sm"
                                            value={anchorSearch}
                                            onChange={(e) => setAnchorSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                                    {filteredAnchorFiles.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No matching documents.</p> : null}
                                    {filteredAnchorFiles.map(file => (
                                        <div 
                                            key={file.id} 
                                            onClick={() => {
                                                setAnchorDocumentId(file.id)
                                                if (targetDocumentIds.includes(file.id)) {
                                                    setTargetDocumentIds(targetDocumentIds.filter(id => id !== file.id))
                                                }
                                            }}
                                            className="px-2 py-1.5 text-sm hover:bg-accent cursor-pointer rounded-md truncate"
                                        >
                                            {file.name}
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Target Documents Selector */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-1/3">
                        <label className="text-xs font-semibold text-muted-foreground">TARGET DOCUMENTS ({targetDocumentIds.length} Selected)</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal text-left h-9 overflow-hidden">
                                    <CheckSquare className="mr-2 h-4 w-4 shrink-0 text-blue-500" />
                                    <span className="truncate">
                                        {targetDocumentIds.length > 0 ? `${targetDocumentIds.length} documents selected` : "Select target documents..."}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <div className="p-2 border-b bg-background z-10">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search documents..."
                                            className="pl-8 h-9 text-sm"
                                            value={targetSearch}
                                            onChange={(e) => setTargetSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                                    <div className="flex justify-between items-center px-1 pb-1 mb-1 border-b">
                                        <span className="text-xs text-muted-foreground">{filteredTargetFiles.length} files</span>
                                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAllTargets}>
                                            Select All
                                        </Button>
                                    </div>
                                    {filteredTargetFiles.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No matching documents.</p> : null}
                                    {filteredTargetFiles.map(file => (
                                        <div 
                                            key={file.id} 
                                            onClick={() => toggleTarget(file.id)}
                                            className="flex items-center px-2 py-1.5 text-sm hover:bg-accent cursor-pointer rounded-md gap-2"
                                        >
                                            {targetDocumentIds.includes(file.id) ? (
                                                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                                            ) : (
                                                <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                            <span className="truncate flex-1">{file.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Prompt Input */}
                    <div className="flex flex-col gap-1.5 w-full sm:flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">ANALYSIS QUERY</label>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="E.g., Compare the termination clauses..." 
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                className="h-9"
                                onKeyDown={e => e.key === 'Enter' && onAnalyze()}
                            />
                            <Button 
                                onClick={onAnalyze} 
                                disabled={isAnalyzing || !anchorDocumentId || targetDocumentIds.length === 0 || !prompt.trim()}
                                className="h-9 gap-1.5 shrink-0"
                            >
                                <Play className="h-3.5 w-3.5" />
                                Analyze
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
