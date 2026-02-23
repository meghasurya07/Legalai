"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { toast } from "sonner"

export type HistoryType = "assistant" | "vault" | "workflow"

export interface HistoryItem {
    id: string
    title: string
    subtitle?: string
    type: HistoryType
    date: Date
    preview: string
    meta?: {
        projectId?: string
        workflowId?: string
        fileCount?: number
    }
}

interface HistoryContextType {
    history: HistoryItem[]
    isLoading: boolean
    addHistoryItem: (item: Omit<HistoryItem, "id" | "date">) => Promise<void>
    clearHistory: () => Promise<void>
    getHistoryByType: (type: HistoryType | "all") => HistoryItem[]
    refreshHistory: () => Promise<void>
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

export function useHistory() {
    const context = useContext(HistoryContext)
    if (!context) {
        throw new Error("useHistory must be used within a HistoryProvider")
    }
    return context
}

export function HistoryProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const refreshHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history')
            if (!response.ok) {
                throw new Error('Failed to fetch history')
            }
            const data = await response.json()
            // Convert date strings to Date objects
            const hydrated = data.map((item: HistoryItem) => ({
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

    const addHistoryItem = async (item: Omit<HistoryItem, "id" | "date">) => {
        try {
            const response = await fetch('/api/history', {
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
            const response = await fetch('/api/history', {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Failed to clear history')
            }

            setHistory([])
            toast.success('History cleared')
        } catch (err) {
            console.error('Error clearing history:', err)
            toast.error('Failed to clear history')
        }
    }

    const getHistoryByType = (type: HistoryType | "all") => {
        if (type === "all") return history
        return history.filter((item) => item.type === type)
    }

    return (
        <HistoryContext.Provider value={{ history, isLoading, addHistoryItem, clearHistory, getHistoryByType, refreshHistory }}>
            {children}
        </HistoryContext.Provider>
    )
}
