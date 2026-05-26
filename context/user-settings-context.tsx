"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

interface UserSettings {
    user_name?: string
    profile_image?: string
}

interface UserSettingsContextType {
    settings: UserSettings
    updateSettings: (newSettings: UserSettings) => void
    refreshSettings: () => Promise<void>
}

const UserSettingsContext = createContext<UserSettingsContextType>({
    settings: {},
    updateSettings: () => { },
    refreshSettings: async () => { },
})

export function UserSettingsProvider({ children }: { children: ReactNode }) {
    // Initialize from localStorage cache for instant render
    const [settings, setSettings] = useState<UserSettings>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const cached = localStorage.getItem('wesley_user_settings')
            return cached ? JSON.parse(cached) : {}
        } catch {
            return {}
        }
    })

    const refreshSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/user/settings')
            const data = await res.json()
            if (data.success && data.data) {
                setSettings(data.data)
                // Persist to localStorage for instant load on next refresh
                try {
                    localStorage.setItem('wesley_user_settings', JSON.stringify(data.data))
                    if (data.data.user_name) {
                        localStorage.setItem('vault_user_name', data.data.user_name)
                    }
                } catch { /* quota exceeded — ignore */ }
            }
        } catch (error) {
            console.error("Failed to load user settings", error)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function loadSettings() {
            try {
                const res = await fetch('/api/user/settings')
                const data = await res.json()
                if (!cancelled && data.success && data.data) {
                    setSettings(data.data)
                    try {
                        localStorage.setItem('wesley_user_settings', JSON.stringify(data.data))
                        if (data.data.user_name) {
                            localStorage.setItem('vault_user_name', data.data.user_name)
                        }
                    } catch { /* quota exceeded */ }
                }
            } catch (error) {
                console.error("Failed to load user settings", error)
            }
        }
        loadSettings()
        return () => { cancelled = true }
    }, [])

    const updateSettings = useCallback((newSettings: UserSettings) => {
        setSettings(newSettings)
        try {
            localStorage.setItem('wesley_user_settings', JSON.stringify(newSettings))
            if (newSettings.user_name) {
                localStorage.setItem('vault_user_name', newSettings.user_name)
            }
        } catch { /* quota exceeded — ignore */ }
    }, [])

    return (
        <UserSettingsContext.Provider value={{ settings, updateSettings, refreshSettings }}>
            {children}
        </UserSettingsContext.Provider>
    )
}

export function useUserSettings() {
    return useContext(UserSettingsContext)
}
