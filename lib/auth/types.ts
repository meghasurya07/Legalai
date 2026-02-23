/**
 * Access Control — Type Definitions
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
export type TeamRole = 'lead' | 'member'
export type InviteStatus = 'pending' | 'accepted' | 'expired'
export type MemberStatus = 'active' | 'invited'

export type Permission =
    | 'org:manage'
    | 'org:view'
    | 'team:manage'
    | 'project:create'
    | 'project:view'
    | 'project:edit'
    | 'project:delete'
    | 'vault:view'
    | 'vault:upload'
    | 'workflow:run'
    | 'workflow:view'
    | 'insight:view'
    | 'admin'

export interface Organization {
    id: string
    name: string
    slug: string
    created_by: string | null
    created_at: string
}

export interface OrgMember {
    id: string
    organization_id: string
    user_id: string
    role: OrgRole
    status: MemberStatus
    created_at: string
}

export interface Team {
    id: string
    organization_id: string
    name: string
    created_at: string
}

export interface TeamMember {
    id: string
    team_id: string
    user_id: string
    role: TeamRole
    created_at: string
}

export interface OrgInvite {
    id: string
    organization_id: string
    email: string
    role: OrgRole
    token: string
    status: InviteStatus
    created_at: string
    expires_at: string
}
