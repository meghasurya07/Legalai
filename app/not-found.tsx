import Link from "next/link"
import { Scale, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-full h-full w-full bg-background text-foreground p-4">
            <div className="flex flex-col items-center max-w-md text-center space-y-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <Scale className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-6xl font-bold tracking-tighter sm:text-7xl">404</h1>
                    <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
                </div>

                <p className="text-muted-foreground">
                    The legal document or section you are looking for does not exist, has been moved, or you may not have permission to access it.
                </p>

                <div className="pt-4">
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/">
                            <Home className="h-4 w-4" />
                            Return to Dashboard
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
