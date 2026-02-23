import React from "react"
import { HelpCircle, Mail } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function HelpPage() {
    return (
        <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 h-full overflow-hidden">
            {/* Header */}
            <div className="space-y-2 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <HelpCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Help & Support</h1>
                        <p className="text-sm text-muted-foreground">Enterprise documentation and technical support.</p>
                    </div>
                </div>
            </div>

            <Separator className="mb-6 shrink-0" />

            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-6">
                <div className="p-6 rounded-full bg-primary/5">
                    <Mail className="h-12 w-12 text-primary/60" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-semibold">Need Assistance?</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        For any questions, workflow assistance, or technical support, please contact your Organization Owner or internal IT helpdesk.
                    </p>
                </div>
            </div>
        </div>
    )
}
