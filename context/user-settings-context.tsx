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
    const [settings, setSettings] = useState<UserSettings>({})

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
            // Restore from localStorage cache first for instant display
            try {
                const cached = localStorage.getItem('wesley_user_settings')
                if (cached) {
                    const parsed = JSON.parse(cached)
                    if (!cancelled && parsed && typeof parsed === 'object') {
                        setSettings(parsed)
                    }
                }
            } catch { /* ignore corrupt cache */ }

            // Then fetch fresh data from API (overwrites cache)
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
