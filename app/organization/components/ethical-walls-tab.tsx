/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import type { EthicalWallData, OrgProject } from "../types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
    Shield,
    Trash2,
    Loader2,
    ShieldAlert,
    Plus,
    X,
    AlertTriangle,
    CheckCircle2,
    Save,
} from "lucide-react"

export default function EthicalWallsTab({ canManage, members }: {
    canManage: boolean
    members: { user_id: string; user_name?: string | null; profile_image?: string | null; role: string }[]
}) {
    const [walls, setWalls] = useState<EthicalWallData[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState<EthicalWallData | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<EthicalWallData | null>(null)
    const [orgProjects, setOrgProjects] = useState<OrgProject[]>([])
    const [saving, setSaving] = useState(false)

    // Form state
    const [formName, setFormName] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [selectedMembers, setSelectedMembers] = useState<string[]>([])
    const [selectedProjects, setSelectedProjects] = useState<string[]>([])

    const fetchWalls = useCallback(async () => {
        try {
            const res = await fetch('/api/org/ethical-walls')
            const data = await res.json()
            if (data.success) setWalls(data.data || [])
        } catch { /* */ } finally { setLoading(false) }
    }, [])

    const fetchProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/documents/projects')
            const data = await res.json()
            if (Array.isArray(data)) setOrgProjects(data.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })))
        } catch { /* */ }
    }, [])

    useEffect(() => { fetchWalls(); fetchProjects() }, [fetchWalls, fetchProjects])

    const resetForm = () => {
        setFormName(''); setFormDescription(''); setSelectedMembers([]); setSelectedProjects([])
    }

    const openCreate = () => {
        resetForm()
        setEditing(null)
        setShowCreate(true)
    }

    const openEdit = (wall: EthicalWallData) => {
        setFormName(wall.name)
        setFormDescription(wall.description || '')
        setSelectedMembers(wall.members.map(m => m.user_id))
        setSelectedProjects(wall.projects.map(p => p.project_id))
        setEditing(wall)
        setShowCreate(true)
    }

    const handleSave = async () => {
        if (!formName.trim() || selectedMembers.length === 0 || selectedProjects.length === 0) {
            toast.error('Name, at least one member, and at least one project are required')
            return
        }
        setSaving(true)
        try {
            const method = editing ? 'PUT' : 'POST'
            const body = editing
                ? { wallId: editing.id, name: formName, description: formDescription, memberUserIds: selectedMembers, projectIds: selectedProjects }
                : { name: formName, description: formDescription, memberUserIds: selectedMembers, projectIds: selectedProjects }

            const res = await fetch('/api/org/ethical-walls', {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            })
            const data = await res.json()
            if (data.success) {
                toast.success(editing ? 'Wall updated' : 'Wall created')
                setShowCreate(false)
                resetForm()
                setEditing(null)
                await fetchWalls()
            } else {
                toast.error(data.error?.message || 'Failed to save wall')
            }
        } catch { toast.error('Failed to save wall') }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setSaving(true)
        try {
            const res = await fetch(`/api/org/ethical-walls?wallId=${deleteTarget.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) {
                toast.success('Wall deleted')
                setDeleteTarget(null)
                await fetchWalls()
            } else {
                toast.error(data.error?.message || 'Failed to delete')
            }
        } catch { toast.error('Failed to delete wall') }
        finally { setSaving(false) }
    }

    const handleToggleStatus = async (wall: EthicalWallData) => {
        const newStatus = wall.status === 'active' ? 'inactive' : 'active'
        try {
            const res = await fetch('/api/org/ethical-walls', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallId: wall.id, status: newStatus })
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`Wall ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
                await fetchWalls()
            }
        } catch { toast.error('Failed to update status') }
    }

    const toggleMember = (uid: string) => {
        setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
    }

    const toggleProject = (pid: string) => {
        setSelectedProjects(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid])
    }

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-amber-500" />
                                Information Barriers
                            </CardTitle>
                            <CardDescription>
                                Prevent lawyers on conflicting matters from accessing each other&apos;s projects and data. Required by ABA rules.
                            </CardDescription>
                        </div>
                        {canManage && (
                            <Button onClick={openCreate} size="sm" className="gap-1">
                                <Plus className="h-4 w-4" /> New Wall
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {walls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="text-sm">No ethical walls configured.</p>
                            <p className="text-xs mt-2">Create a wall to restrict project access between conflicting practice groups.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {walls.map(wall => (
                                <div key={wall.id} className="rounded-lg border p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-semibold">{wall.name}</h4>
                                            <Badge variant={wall.status === 'active' ? 'default' : 'secondary'}>
                                                {wall.status === 'active' ? (
                                                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                                                ) : 'Inactive'}
                                            </Badge>
                                        </div>
                                        {canManage && (
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleToggleStatus(wall)}>
                                                    {wall.status === 'active' ? 'Deactivate' : 'Activate'}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => openEdit(wall)}>Edit</Button>
                                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(wall)} aria-label="Delete wall">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {wall.description && <p className="text-sm text-muted-foreground">{wall.description}</p>}
                                    <div className="flex gap-6 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Members: </span>
                                            <span className="font-medium">{wall.members.length}</span>
                                            {wall.members.length > 0 && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({wall.members.map(m => m.user_name || 'Unknown').join(', ')})
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Projects: </span>
                                            <span className="font-medium">{wall.projects.length}</span>
                                            {wall.projects.length > 0 && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({wall.projects.map(p => p.title || 'Untitled').join(', ')})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Created {new Date(wall.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            {showCreate && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background rounded-xl shadow-2xl border max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
                        <div className="p-6 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">{editing ? 'Edit Wall' : 'Create Ethical Wall'}</h3>
                                <button onClick={() => { setShowCreate(false); setEditing(null); resetForm() }} className="text-muted-foreground hover:text-foreground" title="Close">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <Label>Wall Name *</Label>
                                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Acme Corp v. Beta Inc" />
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Reason for this information barrier..." rows={2} />
                            </div>

                            <div className="space-y-2">
                                <Label>Authorized Members * <span className="text-xs text-muted-foreground font-normal">(only these users can access walled projects)</span></Label>
                                <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                                    {members.map(m => (
                                        <label key={m.user_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                            <input type="checkbox" checked={selectedMembers.includes(m.user_id)} onChange={() => toggleMember(m.user_id)} className="rounded" />
                                            <span>{m.user_name || 'Unnamed User'}</span>
                                            <Badge variant="outline" className="ml-auto text-xs">{m.role}</Badge>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Restricted Projects * <span className="text-xs text-muted-foreground font-normal">(these projects will be hidden from non-members)</span></Label>
                                <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                                    {orgProjects.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-2 text-center">No projects found</p>
                                    ) : orgProjects.map(p => (
                                        <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                            <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} className="rounded" />
                                            <span>{p.title}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    When active, non-members will be unable to see, access, or query any data in the restricted projects.
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm() }}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editing ? 'Update Wall' : 'Create Wall')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background rounded-xl shadow-2xl border max-w-md w-full mx-4 p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-lg">Delete Ethical Wall</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete <strong>&quot;{deleteTarget.name}&quot;</strong>?
                            This will remove all access restrictions. Previously hidden projects will become visible to all org members.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button onClick={handleDelete} disabled={saving} className="bg-red-600 text-white hover:bg-red-700">
                                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</> : 'Delete Wall'}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
