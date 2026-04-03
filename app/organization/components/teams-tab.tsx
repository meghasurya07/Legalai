"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Trash2,
} from "lucide-react"
import type { Team } from "../types"

// =====================================================================

export default function TeamsTab({ canManage }: { canManage: boolean }) {
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
                toast.error(data.error?.message || "Failed to create team")
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
                toast.error(data.error?.message || "Failed to delete team")
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
