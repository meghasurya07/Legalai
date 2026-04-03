// Super Admin shared types

export interface Stats {
    organizations: number
    users: number
    projects: number
    conversations: number
    files: number
}

export interface Org {
    id: string
    name: string
    slug: string
    status: string
    member_count: number
    licensed_seats: number
    sso_domain: string | null
    project_count: number
    created_at: string
}

export interface PlatformUser {
    user_id: string
    role: string
    joined_at: string
    org_id: string
    org_name: string
    display_name: string
    display_image: string | null
}

export interface ActivityEntry {
    id: string
    event_type: string
    project_id: string | null
    ref_id: string | null
    data: Record<string, unknown>
    created_at: string
    org_id: string | null
}

export interface SystemHealth {
    recentErrors: { id: string; event_type: string; data: Record<string, unknown>; created_at: string }[]
    recentJobs: { id: string; type?: string; status?: string; created_at: string; [key: string]: unknown }[]
    tableSizes: { table: string; count: number }[]
    totalTables?: number
    totalRows?: number
}

export interface AnalyticsData {
    totals: { calls: number; tokensIn: number; tokensOut: number; tokens: number; avgLatency: number; cost: number }
    perUser: { userId: string; name: string; calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }[]
    perOrg: { orgId: string; name: string; calls: number; tokensIn: number; tokensOut: number; tokens: number; cost: number }[]
    perModel: { model: string; calls: number; tokens: number; cost: number }[]
    perUseCase: { useCase: string; calls: number; tokens: number; cost: number }[]
    daily: { date: string; calls: number; tokens: number; cost: number }[]
}

export interface AuditEntry {
    id: string
    action: string
    actor_id: string
    actor_name?: string
    resource_type: string
    resource_id: string | null
    details: Record<string, unknown> | null
    created_at: string
    org_id: string | null
}
