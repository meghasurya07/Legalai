"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    Clock,
    Mail,
} from "lucide-react"
import type { Invite } from "../types"

// =====================================================================

export default function InvitationsTab({ canManage, org }: { canManage: boolean; org: { member_count: number; licensed_seats: number } }) {
    const [invites, setInvites] = useState<Invite[]>([])
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState("")
    const [inviteRole, setInviteRole] = useState("member")
    const [sending, setSending] = useState(false)

    const fetchInvites = useCallback(async () => {
        try {
            const res = await fetch("/api/org/invites")
            const data = await res.json()
            if (data.success) setInvites(data.data || [])
        } catch {
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchInvites() }, [fetchInvites])

    const handleInvite = async () => {
        if (!email.trim()) return
        setSending(true)
        try {
            const res = await fetch("/api/org/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role: inviteRole })
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`Invitation sent to ${email}`)
                setEmail("")
                await fetchInvites()
            } else {
                toast.error(data.error?.message || "Failed to send invitation")
            }
        } catch {
            toast.error("Failed to send invitation")
        } finally {
            setSending(false)
        }
    }

    const handleRevoke = async (id: string) => {
        try {
            const res = await fetch(`/api/org/invites?id=${id}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Invitation revoked")
                await fetchInvites()
            } else {
                toast.error(data.error?.message || "Failed to revoke")
            }
        } catch {
            toast.error("Failed to revoke invitation")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Invitations</CardTitle>
                <CardDescription>
                    {org.member_count >= org.licensed_seats
                        ? <span className="text-red-500 font-medium">Seat limit reached ({org.member_count}/{org.licensed_seats}). Contact your administrator to purchase more seats.</span>
                        : <>Invite new members to join your organization. <span className="text-muted-foreground">({org.member_count}/{org.licensed_seats} seats used)</span></>
                    }
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {canManage && (
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                        <Label className="font-medium">Invite by Email</Label>
                        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                            <Input
                                type="email"
                                placeholder="colleague@firm.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="flex-1 min-w-[200px]"
                            />
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleInvite} disabled={sending || !email.trim() || org.member_count >= org.licensed_seats}>
                                {sending ? "Sending…" : "Send Invite"}
                            </Button>
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-sm font-medium mb-3">Pending Invitations</h3>
                    {loading ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                    ) : invites.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No pending invitations.</p>
                    ) : (
                        <div className="space-y-2">
                            {invites.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium">{invite.email}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="h-5 text-[10px]">{invite.role}</Badge>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => handleRevoke(invite.id)}>
                                            Revoke
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
