"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Plus, Pencil, Globe } from "lucide-react"
import type { Org } from "../types"

// =====================================================================
// ORGANIZATIONS TAB
// =====================================================================

export default function OrganizationsTab() {
    const [orgs, setOrgs] = useState<Org[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [showCreate, setShowCreate] = useState(false)
    const [editOrg, setEditOrg] = useState<Org | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state (shared by create + edit)
    const [formName, setFormName] = useState("")
    const [formSlug, setFormSlug] = useState("")
    const [formSeats, setFormSeats] = useState(10)
    const [formSsoDomain, setFormSsoDomain] = useState("")
    const [formStatus, setFormStatus] = useState("active")
    const [formOwnerEmail, setFormOwnerEmail] = useState("")
    const [formError, setFormError] = useState("")

    const fetchOrgs = useCallback(async (s?: string) => {
        setLoading(true)
        try {
            const url = s ? `/api/super-admin/organizations?search=${encodeURIComponent(s)}` : "/api/super-admin/organizations"
            const res = await fetch(url)
            const data = await res.json()
            if (data.success) setOrgs(data.data || [])
        } catch {
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchOrgs() }, [fetchOrgs])

    const handleSearch = () => fetchOrgs(search)

    const openCreate = () => {
        setFormName(""); setFormSlug(""); setFormSeats(10); setFormSsoDomain(""); setFormStatus("active"); setFormOwnerEmail(""); setFormError("")
        setShowCreate(true)
    }

    const openEdit = (org: Org) => {
        setFormName(org.name); setFormSlug(org.slug); setFormSeats(org.licensed_seats); setFormSsoDomain(org.sso_domain || ""); setFormStatus(org.status); setFormError("")
        setEditOrg(org)
    }

    const handleCreate = async () => {
        setSaving(true); setFormError("")
        try {
            const res = await fetch("/api/super-admin/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName, slug: formSlug, licensed_seats: formSeats, sso_domain: formSsoDomain || null, status: formStatus, owner_email: formOwnerEmail || null })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to create"); return }
            if (data.ownerWarning) {
                setFormError(data.ownerWarning)
                // Still close after a delay so user can read the warning
                setTimeout(() => { setShowCreate(false); fetchOrgs() }, 3000)
                return
            }
            setShowCreate(false)
            fetchOrgs()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    const handleUpdate = async () => {
        if (!editOrg) return
        setSaving(true); setFormError("")
        try {
            const res = await fetch("/api/super-admin/organizations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editOrg.id, name: formName, licensed_seats: formSeats, sso_domain: formSsoDomain || null, status: formStatus })
            })
            const data = await res.json()
            if (!data.success) { setFormError(data.error || "Failed to update"); return }
            setEditOrg(null)
            fetchOrgs()
        } catch { setFormError("Network error") } finally { setSaving(false) }
    }

    // Shared modal form
    const renderModal = (title: string, onSave: () => void, onClose: () => void) => (
        typeof window !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={() => { if (!saving) onClose() }} />
                <div className="relative z-[100] w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                    <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Organization Name</label>
                            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Pearson Hardman LLP" className="h-9 text-sm" />
                        </div>
                        {showCreate && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Slug</label>
                                <Input value={formSlug} onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="pearson-hardman" className="h-9 text-sm font-mono" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Licensed Seats</label>
                                <Input type="number" min={1} value={formSeats} onChange={e => setFormSeats(parseInt(e.target.value) || 1)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select title="Organization status" value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">SSO Domain <span className="text-muted-foreground/60">(optional)</span></label>
                            <Input value={formSsoDomain} onChange={e => setFormSsoDomain(e.target.value)} placeholder="pearsonhardman.com" className="h-9 text-sm" />
                        </div>
                        {showCreate && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Firm Admin Email <span className="text-muted-foreground/60">(owner)</span></label>
                                <Input type="email" value={formOwnerEmail} onChange={e => setFormOwnerEmail(e.target.value)} placeholder="admin@pearsonhardman.com" className="h-9 text-sm" />
                                <p className="text-[10px] text-muted-foreground">The user must have an Auth0 account. This org will appear in their dashboard.</p>
                            </div>
                        )}
                        {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors">Cancel</button>
                        <button onClick={onSave} disabled={saving || !formName.trim()} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saving ? "Saving…" : showCreate ? "Create Organization" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
    )

    const seatPct = (m: number, s: number) => s > 0 ? Math.min((m / s) * 100, 100) : 0
    const seatColor = (m: number, s: number) => {
        const pct = seatPct(m, s)
        if (pct >= 90) return "bg-red-500"
        if (pct >= 70) return "bg-amber-500"
        return "bg-emerald-500"
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium">Organizations</h2>
                    <p className="text-xs text-muted-foreground">{orgs.length} registered</p>
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
                        <Plus className="h-3.5 w-3.5" /> New Org
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
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Organization</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Slug</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Seats</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Projects</th>
                                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">SSO Domain</th>
                                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Created</th>
                                <th className="py-2.5 px-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map(org => (
                                <tr key={org.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-3 font-medium">{org.name}</td>
                                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{org.slug}</td>
                                    <td className="py-2.5 px-3">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[11px] font-medium tabular-nums">{org.member_count}/{org.licensed_seats}</span>
                                            <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-300 ${seatColor(org.member_count, org.licensed_seats)}`} style={{ width: `${seatPct(org.member_count, org.licensed_seats)}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-center tabular-nums">{org.project_count}</td>
                                    <td className="py-2.5 px-3">
                                        {org.sso_domain ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                                <Globe className="h-3 w-3" />{org.sso_domain}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/50">—</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        <Badge variant={org.status === "active" ? "default" : "destructive"} className="text-[10px]">{org.status}</Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{new Date(org.created_at).toLocaleDateString()}</td>
                                    <td className="py-2.5 px-2">
                                        <button onClick={() => openEdit(org)} title="Edit organization" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {orgs.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No organizations found.</p>}
                </div>
            )}

            {showCreate && renderModal("Create Organization", handleCreate, () => setShowCreate(false))}
            {editOrg && renderModal(`Edit — ${editOrg.name}`, handleUpdate, () => setEditOrg(null))}
        </div>
    )
}

