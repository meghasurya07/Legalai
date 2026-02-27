"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { toast } from "sonner"

export type RecentChatType = "assistant" | "documents" | "templates"

export interface RecentChatItem {
    id: string
    title: string
    subtitle?: string
    type: RecentChatType
    date: Date
    preview: string
    meta?: {
        projectId?: string
        workflowId?: string
        fileCount?: number
    }
}

interface RecentChatsContextType {
    history: RecentChatItem[]
    isLoading: boolean
    addHistoryItem: (item: Omit<RecentChatItem, "id" | "date">) => Promise<void>
    clearHistory: () => Promise<void>
    getHistoryByType: (type: RecentChatType | "all") => RecentChatItem[]
    refreshHistory: () => Promise<void>
}

const RecentChatsContext = createContext<RecentChatsContextType | undefined>(undefined)

export function useRecentChats() {
    const context = useContext(RecentChatsContext)
    if (!context) {
        throw new Error("useRecentChats must be used within a RecentChatsProvider")
    }
    return context
}

export function RecentChatsProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<RecentChatItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const refreshHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/recent-chats')
            if (!response.ok) {
                throw new Error('Failed to fetch history')
            }
            const data = await response.json()
            // Convert date strings to Date objects
            const hydrated = data.map((item: RecentChatItem) => ({
                ...item,
                date: new Date(item.date)
            }))
            setHistory(hydrated)
        } catch (err) {
            console.error('Error fetching history:', err)
            toast.error('Failed to load history')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshHistory()
    }, [refreshHistory])

    const addHistoryItem = async (item: Omit<RecentChatItem, "id" | "date">) => {
        try {
            const response = await fetch('/api/recent-chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            })

            if (!response.ok) {
                throw new Error('Failed to add history item')
            }

            const newItem = await response.json()
            setHistory(prev => [{
                ...newItem,
                date: new Date(newItem.date)
            }, ...prev])
        } catch (err) {
            console.error('Error adding history item:', err)
        }
    }

    const clearHistory = async () => {
        try {
            const response = await fetch('/api/recent-chats', {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Failed to clear history')
            }

            setHistory([])
            toast.success('Recent chats cleared')
        } catch (err) {
            console.error('Error clearing recent chats:', err)
            toast.error('Failed to clear recent chats')
        }
    }

    const getHistoryByType = (type: RecentChatType | "all") => {
        if (type === "all") return history
        return history.filter((item) => item.type === type)
    }

    return (
        <RecentChatsContext.Provider value={{ history, isLoading, addHistoryItem, clearHistory, getHistoryByType, refreshHistory }}>
            {children}
        </RecentChatsContext.Provider>
    )
}
