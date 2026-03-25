"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"

export interface Org {
    id: string
    name: string
    slug: string
    status: string
    member_count: number
    licensed_seats: number
    created_at: string
}

export interface Member {
    id: string
    user_id: string
    role: string
    created_at: string
    joined_at: string
    user_name?: string | null
    profile_image?: string | null
}

export interface OrgContextType {
    org: Org | null
    members: Member[]
    role: string | null
    isLoading: boolean
    refreshOrg: () => Promise<void>
    refreshMembers: () => Promise<void>
}

export const OrgContext = createContext<OrgContextType>({
    org: null,
    members: [],
    role: null,
    isLoading: true,
    refreshOrg: async () => {},
    refreshMembers: async () => {},
})

export function OrgProvider({ children }: { children: ReactNode }) {
    const { user, isLoading: isUserLoading } = useUser()
    const [org, setOrg] = useState<Org | null>(null)
    const [members, setMembers] = useState<Member[]>([])
    const [role, setRole] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchOrg = useCallback(async () => {
        try {
            const res = await fetch('/api/org')
            const data = await res.json()
            if (data.success && data.data) {
                setOrg(data.data)
                if (data.role) setRole(data.role)
            } else {
                setOrg(null)
            }
        } catch (error) {
            console.error("Failed to fetch org", error)
            setOrg(null)
        }
    }, [])

    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetch('/api/org/members')
            const data = await res.json()
            if (data.success && data.data) {
                setMembers(data.data)

                // Also set the role from members if not already set
                if (user?.sub && !role) {
                    const currentUser = data.data.find((m: Member) => m.user_id === user.sub)
                    if (currentUser) {
                        setRole(currentUser.role)
                    }
                }
            } else {
                setMembers([])
            }
        } catch (error) {
            console.error("Failed to fetch members", error)
            setMembers([])
        }
    }, [user, role])

    useEffect(() => {
        if (isUserLoading) return

        async function loadData() {
            setIsLoading(true)
            if (user) {
                await Promise.all([fetchOrg(), fetchMembers()])
            } else {
                setOrg(null)
                setMembers([])
                setRole(null)
            }
            setIsLoading(false)
        }

        loadData()
    }, [user, isUserLoading, fetchOrg, fetchMembers])

    return (
        <OrgContext.Provider value={{
            org,
            members,
            role,
            isLoading: isLoading || isUserLoading,
            refreshOrg: fetchOrg,
            refreshMembers: fetchMembers
        }}>
            {children}
        </OrgContext.Provider>
    )
}

export function useOrg() {
    return useContext(OrgContext)
}
