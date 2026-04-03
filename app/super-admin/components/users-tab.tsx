"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Users, Search, Loader2, Plus, Trash2 } from "lucide-react"
import type { Org, PlatformUser } from "../types"

// =====================================================================
// USERS TAB
// =====================================================================

export default function UsersTab() {
    const [users, setUsers] = useState<PlatformUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [orgs, setOrgs] = useState<Org[]>([])

    // Create user form state
    const [formName, setFormName] = useState("")
    const [formEmail, setFormEmail] = useState("")
    const [formPassword, setFormPassword] = useState("")
    const [formOrgId, setFormOrgId] = useState("")
    const [formRole, setFormRole] = useState("member")
    const [formError, setFormError] = useState("")

    const fetchUsers = useCallback(async (s?: string) => {
        setLoading(true)
        try {
            const url = s ? `/api/super-admin/users?search=${encodeURIComponent(s)}` : "/api/super-admin/users"
            const res = await fetch(url)
            const data = await res.json()
            if (data.success) setUsers(data.data || [])
        } catch {
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/super-admin/organizations")
            const data = await res.json()
            if (data.success) setOrgs(data.data || [])
        } catch {
        }
    }, [])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const handleSearch = () => fetchUsers(search)

    const openCreate = () => {
        setFormName(""); setFormEmail(""); setFormPassword(""); setFormOrgId(""); setFormRole("member"); setFormError("")
        setShowCreate(true)
        fetchOrgs() // Load orgs for the dropdown
    }

    const handleCreate = async () => {
        setSaving(true); setFormError("")
        try {
            if (!formEmail.trim()) { setFormError("Email is required"); setSaving(false); return }
            if (!formPassword || formPassword.length < 8) { setFormError("Password must be at least 8 characters"); setSaving(false); return }

            const res = await fetch("/api/super-admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formEmail.trim(),
                    name: formName.trim() || undefined,
                    password: formPassword,
                    org_id: formOrgId || undefined,
                    role: formRole,
                })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to create user"); return }
            setShowCreate(false)
            fetchUsers()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium">Users</h2>
                    <p className="text-xs text-muted-foreground">{users.length} across all organizations</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> New User
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">User</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Organization</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Role</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Joined</th>
                                <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user, idx) => (
                                <tr key={`${user.user_id}-${idx}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                            {user.display_image ? (
                                                <div className="h-6 w-6 rounded-full overflow-hidden border shrink-0">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={user.display_image} alt="" className="h-full w-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 border">
                                                    {user.display_name.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium">{user.display_name}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-muted-foreground">{user.org_name}</td>
                                    <td className="py-2.5 px-3 text-center">
                                        <select
                                            title="Change role"
                                            value={user.role}
                                            onChange={async (e) => {
                                                const newRole = e.target.value
                                                await fetch("/api/super-admin/users", {
                                                    method: "PATCH",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ user_id: user.user_id, role: newRole })
                                                })
                                                fetchUsers()
                                            }}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-background cursor-pointer"
                                        >
                                            <option value="owner">owner</option>
                                            <option value="admin">admin</option>
                                            <option value="member">member</option>
                                        </select>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{new Date(user.joined_at).toLocaleDateString()}</td>
                                    <td className="py-2.5 px-3 text-right">
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Remove ${user.display_name} from the platform?`)) return
                                                await fetch("/api/super-admin/users", {
                                                    method: "DELETE",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ user_id: user.user_id })
                                                })
                                                fetchUsers()
                                            }}
                                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 transition-colors"
                                            title="Remove user"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No users found.</p>}
                </div>
            )}

            {/* Create User Modal */}
            {showCreate && typeof window !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={() => { if (!saving) setShowCreate(false) }} />
                    <div className="relative z-[100] w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Create User</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                                    <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Harvey Specter" className="h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Email <span className="text-red-500">*</span></label>
                                    <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="harvey@pearsonhardman.com" className="h-9 text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Password <span className="text-red-500">*</span></label>
                                <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Min 8 characters" className="h-9 text-sm" />
                                <p className="text-[10px] text-muted-foreground">The user can change this later from their profile. Must be at least 8 characters.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Organization <span className="text-muted-foreground/60">(optional)</span></label>
                                    <select title="Select organization" value={formOrgId} onChange={e => setFormOrgId(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                        <option value="">— No org —</option>
                                        {orgs.map(o => (
                                            <option key={o.id} value={o.id}>{o.name} ({o.member_count}/{o.licensed_seats})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                                    <select title="User role" value={formRole} onChange={e => setFormRole(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>
                            </div>
                            {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCreate(false)} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={handleCreate} disabled={saving || !formEmail.trim() || !formPassword} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {saving ? "Creating…" : "Create User"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

