"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DuplicateFileModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function DuplicateFileModal({ isOpen, onOpenChange }: DuplicateFileModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[380px] w-[90vw] p-8 border border-border bg-card text-card-foreground rounded-[28px] gap-6 shadow-2xl"
                showCloseButton={false}
            >
                <DialogHeader className="space-y-3 text-center sm:text-center">
                    <DialogTitle className="text-[20px] font-semibold leading-tight tracking-tight">
                        You&apos;ve already uploaded this file.
                    </DialogTitle>
                    <DialogDescription className="text-[14px] text-muted-foreground font-medium">
                        Try uploading something new.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center flex-col items-center">
                    <Button
                        onClick={() => onOpenChange(false)}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full h-[52px] text-[16px] transition-all duration-200 active:scale-[0.98]"
                    >
                        OK
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
