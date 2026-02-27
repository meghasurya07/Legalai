"use client"

import { useState, useEffect } from "react"
import { useUserSettings } from "@/context/user-settings-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Settings as SettingsIcon, Camera } from "lucide-react"

interface UserSettings {
    user_name?: string;
    profile_image?: string;
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [userSettings, setUserSettings] = useState<UserSettings>({})
    const [savingUser, setSavingUser] = useState(false)
    const { updateSettings: pushToContext } = useUserSettings()

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const userRes = await fetch('/api/user/settings')
                const userData = await userRes.json()
                if (userData.success && userData.data) {
                    setUserSettings(userData.data)
                }
            } catch {
                toast.error("Failed to load settings from server")
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [])

    const handleUserChange = (key: keyof UserSettings, value: unknown) => {
        setUserSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size must be less than 2MB")
            return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const MAX_SIZE = 256
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width
                        width = MAX_SIZE
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height
                        height = MAX_SIZE
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
                handleUserChange('profile_image', compressedBase64)
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const saveUserSettings = async () => {
        setSavingUser(true)
        try {
            const res = await fetch('/api/user/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userSettings)
            })
            const data = await res.json()
            if (data.success) {
                // Push to shared context so sidebar updates live
                pushToContext(userSettings)
                toast.success("Preferences updated successfully")
            } else {
                toast.error("Failed to update preferences")
            }
        } catch {
            toast.error("An error occurred while saving")
        } finally {
            setSavingUser(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 justify-center items-center h-full">
                <p className="text-muted-foreground">Loading settings data...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <SettingsIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
                        <p className="text-sm text-muted-foreground">Manage your personal preferences and profile.</p>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="flex-1 w-full min-w-0 mt-4">
                <Card className="border-none shadow-none bg-transparent sm:bg-card sm:border-solid sm:border">
                    <CardHeader className="px-0 sm:px-6">
                        <CardTitle>User Profile</CardTitle>
                        <CardDescription>Customize how you appear across the application.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 px-0 sm:px-6">
                        <div className="space-y-4">
                            <Label>Custom Profile Picture</Label>
                            <div className="flex items-center gap-6">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Avatar className="h-24 w-24 rounded-full border border-border shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
                                            <AvatarImage src={userSettings.profile_image || "/avatar.png"} alt="Profile Picture" className="object-cover" />
                                            <AvatarFallback>USER</AvatarFallback>
                                        </Avatar>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-6 border-none bg-transparent shadow-none">
                                        <DialogHeader className="sr-only">
                                            <DialogTitle>Profile Picture Preview</DialogTitle>
                                        </DialogHeader>
                                        <div className="relative h-64 w-64 md:h-80 md:w-80 rounded-full overflow-hidden border-4 border-background shadow-2xl">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={userSettings.profile_image || "/avatar.png"} alt="Profile Preview" className="h-full w-full object-cover" />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <div className="space-y-2">
                                    <Label htmlFor="picture-upload" className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                                        <Camera className="h-4 w-4" />
                                        Upload New Photo
                                    </Label>
                                    <Input
                                        id="picture-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                    <p className="text-xs text-muted-foreground">Recommended size: 256x256px. Max 2MB.</p>
                                    {userSettings.profile_image && (
                                        <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 mt-1" onClick={() => handleUserChange('profile_image', undefined)}>
                                            Remove Photo
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Preferred Display Name</Label>
                            <Input
                                value={userSettings.user_name || ''}
                                onChange={(e) => handleUserChange('user_name', e.target.value)}
                                placeholder="e.g. Alex"
                                className="max-w-md"
                            />
                            <p className="text-sm text-muted-foreground">The assistant will use this name to address you.</p>
                        </div>

                        <div className="flex justify-end pt-6 border-t">
                            <Button onClick={saveUserSettings} disabled={savingUser}>
                                {savingUser ? "Saving..." : "Save Preferences"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
