"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useUserSettings } from "@/context/user-settings-context"
import {
    BookOpen,
    Building2,
    History,
    LayoutGrid,
    Library,
    Settings,
    HelpCircle,
    ChevronDown,
    LogOut,
    MessageSquarePlus,
    ShieldAlert
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarGroup,
    SidebarGroupContent,
} from "@/components/ui/sidebar"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()
    const router = useRouter()
    const { user } = useUser()
    const { settings: userSettings } = useUserSettings()

    const userName = userSettings.user_name || user?.name || "User Name"
    const userEmail = user?.email || "user@example.com"
    const userInitials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    // Check if user is a super admin
    const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)
    React.useEffect(() => {
        fetch("/api/super-admin/stats")
            .then(r => setIsSuperAdmin(r.ok))
            .catch(() => setIsSuperAdmin(false))
    }, [])

    // Extract Auth0 roles from user session
    const roles = user?.['https://askwesley.com/roles'] as string[] | undefined;
    const isFirmAdmin = roles?.includes('FIRM_ADMIN') || false;

    return (
        <Sidebar collapsible="icon" className="border-r-0 bg-sidebar/50 backdrop-blur-md" {...props}>
            <SidebarHeader className="pt-4 pb-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex items-center gap-3 px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background transition-colors">
                                <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L4.5 13H5.5L8 4.5L10.5 13H11.5L15 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                <span className="tracking-[0.18em] font-semibold text-foreground text-[11px] uppercase">Wesley</span>
                            </div>
                        </div>
                    </SidebarMenuItem>

                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton tooltip="New Chat" className="mb-2 rounded-xl" onClick={() => { router.push('/'); router.refresh() }}>
                                    <MessageSquarePlus className="text-muted-foreground" />
                                    <span className="font-medium">New Chat</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <div className="mx-3 my-2 border-t border-border" />
                            <SidebarMenuItem>
                                <SidebarMenuButton isActive={pathname === '/' || pathname === '/chat'} tooltip="Workspace" onClick={() => router.push('/')}>
                                    <LayoutGrid />
                                    <span>Workspace</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton isActive={pathname?.startsWith('/documents')} tooltip="Documents" onClick={() => router.push('/documents')}>
                                    <BookOpen />
                                    <span>Documents</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton isActive={pathname === '/templates'} tooltip="Templates" onClick={() => router.push('/templates')}>
                                    <Library />
                                    <span>Templates</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton isActive={pathname === '/recent-chats'} tooltip="Recent Chats" onClick={() => router.push('/recent-chats')}>
                                    <History />
                                    <span>Recent Chats</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>

                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton size="lg" className="h-auto p-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" tooltip="User Profile">
                                    <div className="flex items-center gap-2 w-full">
                                        <Avatar className="h-8 w-8 rounded-full">
                                            <AvatarImage src={userSettings.profile_image || user?.picture || "/avatar.png"} alt={userName} className="object-cover" />
                                            <AvatarFallback>{userInitials}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                            <span className="truncate font-semibold">{userName}</span>
                                            <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                                        </div>
                                        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                                    </div>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-56"
                                side="top"
                                align="end"
                                sideOffset={8}
                            >
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{userName}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {userEmail}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Settings</span>
                                    </DropdownMenuItem>
                                    
                                    {isFirmAdmin && (
                                        <DropdownMenuItem onClick={() => router.push('/organization')}>
                                            <Building2 className="mr-2 h-4 w-4" />
                                            <span>Organization</span>
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem onClick={() => router.push('/help')}>
                                        <HelpCircle className="mr-2 h-4 w-4" />
                                        <span>Help</span>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                {isSuperAdmin && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem onClick={() => router.push('/super-admin')}>
                                                <ShieldAlert className="mr-2 h-4 w-4 text-red-500" />
                                                <span>Super Admin</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                                    onClick={() => {
                                        toast.success('Logging out...')
                                        window.location.href = '/auth/logout'
                                    }}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

