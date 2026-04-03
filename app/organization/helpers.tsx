import { Crown, Shield } from "lucide-react"

export const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-3.5 w-3.5 text-amber-500" />
    if (role === "admin") return <Shield className="h-3.5 w-3.5 text-blue-400" />
    return null
}

export const roleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "owner") return "default"
    if (role === "admin") return "secondary"
    return "outline"
}
