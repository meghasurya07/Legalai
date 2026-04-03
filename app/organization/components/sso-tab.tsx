/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
    Users,
    Key,
    Loader2,
    X,
    Save,
} from "lucide-react"

// =====================================================================

export default function SsoTab({ canManage }: { canManage: boolean }) {
    const [domain, setDomain] = useState("")
    const [signInUrl, setSignInUrl] = useState("")
    const [cert, setCert] = useState("")
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(false)
    const [status, setStatus] = useState<"none" | "active">("none")
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const handleCheck = async () => {
        if (!domain) return
        setChecking(true)
        try {
            const res = await fetch(`/api/org/sso?domain=${domain}`)
            const data = await res.json()
            if (data.exists && data.connection) {
                setStatus("active")
                setSignInUrl(data.connection.options?.signInEndpoint || "")
                setCert(data.connection.options?.signingCert || "")
            } else {
                toast.error("No SSO configuration found for this domain.")
                setStatus("none")
                setSignInUrl("")
                setCert("")
            }
        } catch (err) {
            toast.error(`Failed to check SSO status: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setChecking(false)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/org/sso", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain, signInEndpoint: signInUrl, cert })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("SSO Configuration Applied")
                setStatus("active")
            } else {
                toast.error(data.error?.message || data.detail || "Failed to save SSO config")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/org/sso?domain=${domain}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("SSO Configuration Removed")
                setStatus("none")
                setSignInUrl("")
                setCert("")
                setShowDeleteConfirm(false)
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" /> Single Sign-On (SAML)
                </CardTitle>
                <CardDescription>Configure Enterprise SSO via Okta, Azure AD, or any SAML 2.0 Identity Provider. When active, members logging in with this domain will instantly be redirected to your secure portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Email Domain</Label>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="lawfirm.com" 
                                value={domain} 
                                onChange={e => {
                                    setDomain(e.target.value.toLowerCase().trim())
                                    setStatus("none")
                                }} 
                            />
                            <Button variant="secondary" onClick={handleCheck} disabled={checking || !domain}>
                                {checking ? "Checking..." : "Load Domain"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">The domain used to route users to your Identity Provider. Avoid prefixes like @.</p>
                    </div>

                    {status === "active" && (
                        <div className="rounded-md bg-emerald-500/10 p-3 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2 font-medium">
                            <Key className="h-4 w-4" /> SSO is Active for this Domain
                        </div>
                    )}

                    <div className="space-y-2 pt-4 border-t">
                        <Label>IdP Sign-In URL</Label>
                        <Input 
                            placeholder="https://company.okta.com/app/.../sso/saml" 
                            value={signInUrl} 
                            onChange={e => setSignInUrl(e.target.value)} 
                            disabled={!canManage}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>X.509 Public Certificate</Label>
                        <Textarea 
                            placeholder="-----BEGIN CERTIFICATE-----\nMIIDpDCCAoyg...\n-----END CERTIFICATE-----" 
                            value={cert} 
                            onChange={e => setCert(e.target.value)} 
                            disabled={!canManage}
                            className="font-mono text-xs min-h-[150px]"
                        />
                    </div>

                    {canManage && (
                        <div className="flex justify-between pt-4 border-t">
                            {status === "active" ? (
                                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>Disable & Delete</Button>
                            ) : <div></div>}
                            <Button onClick={handleSave} disabled={loading || !domain || !signInUrl || !cert}>
                                {loading ? "Saving..." : "Save Configuration"}
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
            </Card>
            {showDeleteConfirm && typeof window !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                        onClick={() => { if (!loading) setShowDeleteConfirm(false) }}
                    />
                    {/* Dialog */}
                    <div className="relative z-[100] w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-foreground">Disable SSO connection?</h2>
                            <p className="text-sm text-muted-foreground">
                                This will instantly sever the SAML connection for <strong>{domain}</strong>. Users will immediately fall back to standard password login. This action cannot be undone.
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
                                className="rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 block text-center"
                            >
                                {loading ? (
                                    <span className="flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Disabling...</span>
                                ) : (
                                    'Disable SSO'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
