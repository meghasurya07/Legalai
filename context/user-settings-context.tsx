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
            }
        } catch (error) {
            console.error("Failed to load user settings", error)
        }
    }, [])

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await fetch('/api/user/settings')
                const data = await res.json()
                if (data.success && data.data) {
                    setSettings(data.data)
                }
            } catch (error) {
                console.error("Failed to load user settings", error)
            }
        }
        loadSettings()
    }, [])

    const updateSettings = useCallback((newSettings: UserSettings) => {
        setSettings(newSettings)
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
