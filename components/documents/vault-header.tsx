import { Separator } from "@/components/ui/separator"

export function VaultHeader() {
    return (
        <div className="flex flex-col gap-4 pb-0" id="vault-header">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
                <p className="text-sm text-muted-foreground">Store and analyze thousands of files</p>
            </div>
            <Separator className="mt-4" />
        </div>
    )
}
