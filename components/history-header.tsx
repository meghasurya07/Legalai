"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Search,
    Trash2,
    History as HistoryIcon,
    SlidersHorizontal
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface HistoryHeaderProps {
    onSearch: (query: string) => void
    onClearAll: () => void
    onSort: (sortBy: "recent" | "title" | "category") => void
    currentSort: "recent" | "title" | "category"
    totalItems: number
}

export function HistoryHeader({
    onSearch,
    onClearAll,
    onSort,
    currentSort,
    totalItems
}: HistoryHeaderProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [showClearDialog, setShowClearDialog] = useState(false)

    const handleSearch = (value: string) => {
        setSearchQuery(value)
        onSearch(value)
    }

    const handleClearAll = () => {
        onClearAll()
        setShowClearDialog(false)
    }

    const sortLabels = {
        recent: "Most Recent",
        title: "Title (A-Z)",
        category: "Category"
    }

    return (
        <>
            <div className="space-y-4 md:space-y-6">
                {/* Title Section */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                                <HistoryIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold">Recent Chats</h1>
                        </div>
                        <p className="text-sm md:text-base text-muted-foreground">
                            View and manage all your chat history across Chat, Documents, and Templates
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground mt-1">
                            {totalItems} {totalItems === 1 ? "item" : "items"} in history
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setShowClearDialog(true)}
                        disabled={totalItems === 0}
                        className="w-full md:w-auto"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                    </Button>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search history..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto">
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Sort: </span>{sortLabels[currentSort]}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onSort("recent")}>
                                Most Recent
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSort("title")}>
                                Title (A-Z)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSort("category")}>
                                Category
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Clear All Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear All Recent Chats?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {totalItems} items from your history.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearAll}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
