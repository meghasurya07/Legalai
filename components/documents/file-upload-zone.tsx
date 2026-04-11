"use client"

import { Upload, CheckCircle2 } from "lucide-react"

interface FileUploadZoneProps {
    id: string
    file: File | null
    onFileSelect: (file: File) => void
    accept?: string
}

export function FileUploadZone({ id, file, onFileSelect, accept }: FileUploadZoneProps) {
    return (
        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
                type="file"
                id={id}
                className="hidden"
                accept={accept}
                onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            />
            <label htmlFor={id} className="cursor-pointer">
                {file ? (
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <p className="font-medium">Click to upload</p>
                        <p className="text-sm text-muted-foreground">Any file type supported</p>
                    </div>
                )}
            </label>
        </div>
    )
}
