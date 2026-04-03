// Shared types for organization admin page

export interface Team {
    id: string
    name: string
    description?: string
    member_count: number
    created_at: string
}

export interface Invite {
    id: string
    email: string
    role: string
    status: string
    created_at: string
    expires_at: string
}

export interface AuditEntry {
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

export interface OrgMember {
    id: string
    user_id: string
    role: string
    joined_at?: string
    created_at: string
    user_name?: string | null
    profile_image?: string | null
}

export interface OrgData {
    id: string
    name: string
    slug: string
    status: string
    member_count: number
    licensed_seats: number
    created_at: string
}

export interface EthicalWallData {
    id: string
    name: string
    description?: string
    status: string
    members: { user_id: string; user_name?: string | null }[]
    projects: { project_id: string; title?: string | null }[]
    created_at: string
}

export interface OrgProject {
    id: string
    title: string
}

export interface OrgMemory {
    id: string
    content: string
    memory_type: string
    is_pinned: boolean
    user_id: string
    user_name?: string | null
    user_profile_image?: string | null
    category?: string
    source?: string
    created_at: string
    updated_at?: string
}

