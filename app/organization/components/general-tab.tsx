/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Save,
} from "lucide-react"

// =====================================================================

export default function GeneralTab({ org, canManage, refreshOrg }: {
    org: { id: string; name: string; slug: string; status: string; member_count: number; licensed_seats: number; created_at: string }
    canManage: boolean
    refreshOrg: () => Promise<void>
}) {
    const [name, setName] = useState(org.name)
    const [slug, setSlug] = useState(org.slug)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/org", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, slug })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Organization updated")
                await refreshOrg()
            } else {
                toast.error(data.error?.message || "Failed to update")
            }
        } catch {
            toast.error("Failed to save changes")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Basic information about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} disabled={!canManage} />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                            value={slug}
                            onChange={e => {
                                const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                setSlug(sanitized)
                            }}
                            disabled={!canManage}
                        />
                        <p className="text-xs text-muted-foreground">Used in URLs. Letters, numbers, and hyphens only.</p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <p className="font-medium capitalize">{org.status}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Seat Usage</Label>
                        <p className="font-medium">{org.member_count} / {org.licensed_seats} seats</p>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    (org.member_count / org.licensed_seats) >= 0.9 ? 'bg-red-500' :
                                    (org.member_count / org.licensed_seats) >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min((org.member_count / org.licensed_seats) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Created</Label>
                        <p className="font-medium">{new Date(org.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                {canManage && (
                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : "Save Changes"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
