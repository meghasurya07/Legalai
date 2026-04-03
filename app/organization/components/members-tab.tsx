/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    Trash2,
} from "lucide-react"
import { roleIcon, roleBadgeVariant } from "../helpers"

// =====================================================================

export default function MembersTab({ members, canManage, refreshMembers }: {
    members: { id: string; user_id: string; role: string; joined_at?: string; created_at: string; user_name?: string | null; profile_image?: string | null }[]
    canManage: boolean
    refreshMembers: () => Promise<void>
}) {
    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const res = await fetch("/api/org/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, role: newRole })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Role updated")
                await refreshMembers()
            } else {
                toast.error(data.error?.message || "Failed to update role")
            }
        } catch {
            toast.error("Failed to update role")
        }
    }

    const handleRemove = async (userId: string) => {
        if (!confirm("Remove this member from the organization?")) return
        try {
            const res = await fetch(`/api/org/members?user_id=${encodeURIComponent(userId)}`, {
                method: "DELETE"
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Member removed")
                await refreshMembers()
            } else {
                toast.error(data.error?.message || "Failed to remove member")
            }
        } catch {
            toast.error("Failed to remove member")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""} in this organization.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                {member.profile_image ? (
                                    <div className="h-9 w-9 rounded-full bg-muted shrink-0 overflow-hidden border">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={member.profile_image} alt={member.user_name || member.user_id} className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0 border border-primary/10 text-primary">
                                        {member.user_name
                                            ? member.user_name.substring(0, 2).toUpperCase()
                                            : (member.user_name || 'U').substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="truncate">
                                    <p className="text-sm font-medium truncate">{member.user_name || 'Unnamed User'}</p>
                                    <p className="text-xs text-muted-foreground">Joined {new Date(member.joined_at || member.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {canManage && member.role !== "owner" ? (
                                    <Select value={member.role} onValueChange={val => handleRoleChange(member.user_id, val)}>
                                        <SelectTrigger className="w-[110px] h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Badge variant={roleBadgeVariant(member.role)} className="gap-1">
                                        {roleIcon(member.role)}
                                        {member.role}
                                    </Badge>
                                )}
                                {canManage && member.role !== "owner" && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemove(member.user_id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No members found.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
