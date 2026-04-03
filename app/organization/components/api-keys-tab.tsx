/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    Shield,
    Key,
    Loader2,
    Save,
} from "lucide-react"

// =====================================================================

export default function ApiKeysTab({ canManage }: { canManage: boolean }) {
    const [provider, setProvider] = useState<string>("none")
    const [apiKey, setApiKey] = useState("")
    const [azureEndpoint, setAzureEndpoint] = useState("")
    const [azureDeployment, setAzureDeployment] = useState("")
    const [keyHint, setKeyHint] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Fetch current BYOK config
    useEffect(() => {
        fetch("/api/org/byok")
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setProvider(data.data.provider || "none")
                    setKeyHint(data.data.keyHint)
                    setAzureEndpoint(data.data.azureEndpoint || "")
                    setAzureDeployment(data.data.azureDeployment || "")
                }
            })
            .catch(() => { })
            .finally(() => setFetching(false))
    }, [])

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast.error("Please enter an API key")
            return
        }
        if (provider === "azure_openai" && (!azureEndpoint.trim() || !azureDeployment.trim())) {
            toast.error("Azure endpoint and deployment name are required")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/org/byok", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: provider === "none" ? "openai" : provider,
                    apiKey: apiKey.trim(),
                    azureEndpoint: azureEndpoint.trim() || undefined,
                    azureDeployment: azureDeployment.trim() || undefined,
                })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("API key saved and validated successfully")
                setKeyHint(data.data.keyHint)
                setProvider(data.data.provider)
                setApiKey("")
            } else {
                toast.error(data.error?.message || "Failed to save API key")
            }
        } catch {
            toast.error("An error occurred while saving")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/org/byok", { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("API key removed. Reverted to Wesley default.")
                setProvider("none")
                setKeyHint(null)
                setApiKey("")
                setAzureEndpoint("")
                setAzureDeployment("")
                setShowDeleteConfirm(false)
            } else {
                toast.error(data.error?.message || "Failed to remove API key")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    if (fetching) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    }

    const isConfigured = provider !== "none" && keyHint

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" /> Bring Your Own Key (BYOK)
                    </CardTitle>
                    <CardDescription>
                        Use your organization&apos;s own OpenAI or Azure OpenAI API key for all AI features. 
                        Your data routing and billing go through your own account. Wesley controls which models are used.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Current Status */}
                    {isConfigured && (
                        <div className="rounded-md bg-emerald-500/10 p-3 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2 font-medium">
                            <Shield className="h-4 w-4" /> 
                            BYOK Active — {provider === "azure_openai" ? "Azure OpenAI" : "OpenAI"} ({keyHint})
                        </div>
                    )}

                    {!isConfigured && (
                        <div className="rounded-md bg-muted p-3 border text-sm text-muted-foreground">
                            Using Wesley&apos;s default API key. Configure your own key below for dedicated billing and data routing.
                        </div>
                    )}

                    {canManage && (
                        <div className="space-y-4 pt-2">
                            {/* Provider Selection */}
                            <div className="space-y-2">
                                <Label>Provider</Label>
                                <Select
                                    value={provider === "none" ? "openai" : provider}
                                    onValueChange={(v) => setProvider(v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {provider === "azure_openai" 
                                        ? "Data stays in your Azure tenant. Requires a deployed OpenAI model in your Azure account." 
                                        : "Standard OpenAI API. Billing goes through your OpenAI account."
                                    }
                                </p>
                            </div>

                            {/* API Key */}
                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    placeholder={isConfigured ? `Current: ${keyHint}  •  Enter new key to replace` : provider === "azure_openai" ? "Enter your Azure API key" : "sk-..."}
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Your key is encrypted at rest (AES-256-GCM) and never stored in plaintext.
                                </p>
                            </div>

                            {/* Azure-specific fields */}
                            {(provider === "azure_openai") && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Azure Endpoint URL</Label>
                                        <Input
                                            placeholder="https://your-resource.openai.azure.com"
                                            value={azureEndpoint}
                                            onChange={e => setAzureEndpoint(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deployment Name</Label>
                                        <Input
                                            placeholder="gpt-4o"
                                            value={azureDeployment}
                                            onChange={e => setAzureDeployment(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            The deployment must use the same model version Wesley requires (e.g., gpt-4o).
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Actions */}
                            <div className="flex justify-between pt-4 border-t">
                                {isConfigured ? (
                                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
                                        Remove Key
                                    </Button>
                                ) : <div />}
                                <Button 
                                    onClick={handleSave} 
                                    disabled={loading || !apiKey.trim()}
                                >
                                    {loading ? (
                                        <span className="flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Validating & Saving...</span>
                                    ) : (
                                        isConfigured ? "Update Key" : "Save & Activate"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {!canManage && (
                        <p className="text-sm text-muted-foreground italic">
                            Only organization owners and admins can manage API keys.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Portal */}
            {showDeleteConfirm && typeof window !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                        onClick={() => { if (!loading) setShowDeleteConfirm(false) }}
                    />
                    <div className="relative z-[100] w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-foreground">Remove API Key?</h2>
                            <p className="text-sm text-muted-foreground">
                                This will immediately revert all AI features to use Wesley&apos;s default API key. 
                                Your organization&apos;s key will be permanently deleted from our servers.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={loading}
                                className="rounded-lg"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={loading}
                                className="rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                            >
                                {loading ? (
                                    <span className="flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Removing...</span>
                                ) : 'Remove Key'}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
