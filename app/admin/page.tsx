"use client"

import { useState, useEffect, useCallback } from "react"
import { useOrg } from "@/context/org-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    Building2,
    Users,
    UserPlus,
    Shield,
    Trash2,
    Crown,
    ScrollText,
    Clock,
    Mail,
    Layers
} from "lucide-react"

// =====================================================================
// TYPES
// =====================================================================

interface Team {
    id: string
    name: string
    description?: string
    member_count: number
    created_at: string
}

interface Invite {
    id: string
    email: string
    role: string
    status: string
    created_at: string
    expires_at: string
}

interface AuditEntry {
    id: string
    action: string
    actor_user_id: string
    actor_name?: string | null
    actor_image?: string | null
    target_entity: string
    target_id?: string
    metadata: Record<string, unknown>
    created_at: string
}

// =====================================================================
// TABS
// =====================================================================

type TabKey = "general" | "members" | "teams" | "invitations" | "audit"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <Building2 className="h-4 w-4" /> },
    { key: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
    { key: "teams", label: "Teams", icon: <Layers className="h-4 w-4" /> },
    { key: "invitations", label: "Invitations", icon: <UserPlus className="h-4 w-4" /> },
    { key: "audit", label: "Audit Log", icon: <ScrollText className="h-4 w-4" /> },
]

// =====================================================================
// ROLE HELPERS
// =====================================================================

const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-3.5 w-3.5 text-amber-500" />
    if (role === "admin") return <Shield className="h-3.5 w-3.5 text-blue-400" />
    return null
}

const roleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "owner") return "default"
    if (role === "admin") return "secondary"
    return "outline"
}

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function OrganizationAdminPage() {
    const { org, members, role, isLoading, refreshOrg, refreshMembers } = useOrg()
    const [activeTab, setActiveTab] = useState<TabKey>("general")

    if (isLoading) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">Loading organization data…</p>
            </div>
        )
    }

    if (!org) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">No organization found. Please sign in.</p>
            </div>
        )
    }

    const canManage = role === "owner" || role === "admin"

    return (
        <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4 md:p-6 pb-20 overflow-y-auto">
            {/* Header */}
            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Organization</h1>
                        <p className="text-sm text-muted-foreground">Manage {org.name}</p>
                    </div>
                </div>
            </div>

            <Separator className="mb-6" />

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "general" && <GeneralTab org={org} canManage={canManage} refreshOrg={refreshOrg} />}
            {activeTab === "members" && <MembersTab members={members} canManage={canManage} refreshMembers={refreshMembers} />}
            {activeTab === "teams" && <TeamsTab canManage={canManage} />}
            {activeTab === "invitations" && <InvitationsTab canManage={canManage} />}
            {activeTab === "audit" && <AuditTab />}
        </div>
    )
}

// =====================================================================
// GENERAL TAB
// =====================================================================

function GeneralTab({ org, canManage, refreshOrg }: {
    org: { id: string; name: string; slug: string; status: string; member_count: number; created_at: string }
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
                toast.error(data.error || "Failed to update")
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
                        <Label className="text-xs text-muted-foreground">Members</Label>
                        <p className="font-medium">{org.member_count}</p>
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

// =====================================================================
// MEMBERS TAB
// =====================================================================

function MembersTab({ members, canManage, refreshMembers }: {
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
                toast.error(data.error || "Failed to update role")
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
                toast.error(data.error || "Failed to remove member")
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
                                            : member.user_id.substring(member.user_id.length - 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="truncate">
                                    <p className="text-sm font-medium truncate">{member.user_name || member.user_id}</p>
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

// =====================================================================
// TEAMS TAB
// =====================================================================

function TeamsTab({ canManage }: { canManage: boolean }) {
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [newTeamName, setNewTeamName] = useState("")
    const [newTeamDesc, setNewTeamDesc] = useState("")
    const [creating, setCreating] = useState(false)

    const fetchTeams = useCallback(async () => {
        try {
            const res = await fetch("/api/org/teams")
            const data = await res.json()
            if (data.success) setTeams(data.data || [])
        } catch {
            console.error("Failed to fetch teams")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchTeams() }, [fetchTeams])

    const handleCreate = async () => {
        if (!newTeamName.trim()) return
        setCreating(true)
        try {
            const res = await fetch("/api/org/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTeamName, description: newTeamDesc })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Team created")
                setNewTeamName("")
                setNewTeamDesc("")
                await fetchTeams()
            } else {
                toast.error(data.error || "Failed to create team")
            }
        } catch {
            toast.error("Failed to create team")
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this team? Projects assigned to it will be unassigned.")) return
        try {
            const res = await fetch(`/api/org/teams?id=${id}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Team deleted")
                await fetchTeams()
            } else {
                toast.error(data.error || "Failed to delete team")
            }
        } catch {
            toast.error("Failed to delete team")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Teams</CardTitle>
                <CardDescription>Organize members into teams to manage project access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {canManage && (
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                        <Label className="font-medium">Create New Team</Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Input placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                            <Input placeholder="Description (optional)" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} />
                        </div>
                        <Button onClick={handleCreate} disabled={creating || !newTeamName.trim()} size="sm">
                            {creating ? "Creating…" : "Create Team"}
                        </Button>
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Loading teams…</p>
                ) : teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No teams yet. Create one to get started.</p>
                ) : (
                    <div className="space-y-2">
                        {teams.map(team => (
                            <div key={team.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                <div>
                                    <p className="text-sm font-medium">{team.name}</p>
                                    {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">{team.member_count} members</p>
                                </div>
                                {canManage && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(team.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// =====================================================================
// INVITATIONS TAB
// =====================================================================

function InvitationsTab({ canManage }: { canManage: boolean }) {
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
            console.error("Failed to fetch invites")
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
                toast.error(data.error || "Failed to send invitation")
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
                toast.error(data.error || "Failed to revoke")
            }
        } catch {
            toast.error("Failed to revoke invitation")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Invitations</CardTitle>
                <CardDescription>Invite new members to join your organization.</CardDescription>
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
                            <Button onClick={handleInvite} disabled={sending || !email.trim()}>
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

// =====================================================================
// AUDIT LOG TAB
// =====================================================================

function AuditTab() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                const res = await fetch("/api/org/audit-log?limit=50")
                const data = await res.json()
                if (data.success) {
                    setEntries(data.data || [])
                    setTotal(data.total || 0)
                }
            } catch {
                console.error("Failed to fetch audit log")
            } finally {
                setLoading(false)
            }
        }
        fetchAudit()
    }, [])

    const actionLabel = (action: string) => {
        const map: Record<string, string> = {
            "org.updated": "Updated organization",
            "member.invited": "Invited member",
            "member.joined": "Member joined",
            "member.role_changed": "Changed member role",
            "member.removed": "Removed member",
            "invite.created": "Created invitation",
            "invite.revoked": "Revoked invitation",
            "invite.accepted": "Accepted invitation",
            "team.created": "Created team",
            "team.updated": "Updated team",
            "team.deleted": "Deleted team",
            "team.member_added": "Added team member",
            "team.member_removed": "Removed team member",
            "project.created": "Created project",
            "project.deleted": "Deleted project"
        }
        return map[action] || action
    }

    return (
        <Card className="flex flex-col max-h-[calc(100vh-240px)]">
            <CardHeader className="shrink-0">
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                    {total} recorded actions
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2">
                {loading ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Loading audit log…</p>
                ) : entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No audit entries yet.</p>
                ) : (
                    <div className="space-y-1">
                        {entries.map(entry => (
                            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                                {entry.actor_image ? (
                                    <div className="h-8 w-8 rounded-full bg-muted shrink-0 overflow-hidden border mt-0.5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={entry.actor_image} alt={entry.actor_name || entry.actor_user_id} className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5 border border-primary/10 text-primary">
                                        {entry.actor_name
                                            ? entry.actor_name.substring(0, 2).toUpperCase()
                                            : entry.actor_user_id.substring(entry.actor_user_id.length - 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm">
                                        <span className="font-medium">{actionLabel(entry.action)}</span>
                                        {entry.target_id && (
                                            <span className="text-muted-foreground"> · {entry.target_entity}</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(entry.created_at).toLocaleString()}
                                        {" · "}
                                        {entry.actor_name || entry.actor_user_id.substring(0, 20)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
