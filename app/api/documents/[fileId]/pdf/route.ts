import { NextRequest, NextResponse } from "next/server"
import { auth0 } from "@/lib/auth/auth0"
import { supabase } from "@/lib/supabase/server"

/**
 * GET /api/documents/[fileId]/pdf
 * 
 * Streams the raw PDF binary for the given file ID.
 * Used by the inline PDF citation viewer to load documents without CORS issues.
 * Requires authentication.
 * 
 * The `files` table stores the Supabase Storage path in the `url` column
 * (e.g. "projects/{projectId}/filename.pdf").
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        // Authenticate
        const session = await auth0.getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { fileId } = await params
        if (!fileId) {
            return NextResponse.json({ error: "File ID required" }, { status: 400 })
        }

        // Fetch file record — `url` holds the Supabase storage path
        const { data: file, error: fileError } = await supabase
            .from("files")
            .select("id, name, url, type, project_id")
            .eq("id", fileId)
            .single()

        if (fileError || !file) {
            console.error('[PDF Route] DB error:', fileError)
            return NextResponse.json({ error: "File not found" }, { status: 404 })
        }

        if (!file.url) {
            return NextResponse.json({ error: "No file URL available" }, { status: 404 })
        }

        // The `url` column stores the Supabase storage path (e.g. "projects/xxx/file.pdf")
        // Try downloading from Supabase Storage first
        const { data: blob, error: downloadError } = await supabase.storage
            .from("documents")
            .download(file.url)

        if (!downloadError && blob) {
            const buffer = await blob.arrayBuffer()

            // Determine content type from file record or default to PDF
            const contentType = file.type || "application/pdf"

            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `inline; filename="${file.name || "document.pdf"}"`,
                    "Cache-Control": "private, max-age=3600",
                },
            })
        }

        // If storage download failed, try fetching URL directly (in case it's an external URL)
        if (file.url.startsWith("http")) {
            const response = await fetch(file.url)
            if (response.ok) {
                const buffer = await response.arrayBuffer()
                return new NextResponse(buffer, {
                    headers: {
                        "Content-Type": response.headers.get("Content-Type") || "application/pdf",
                        "Content-Disposition": `inline; filename="${file.name || "document.pdf"}"`,
                        "Cache-Control": "private, max-age=3600",
                    },
                })
            }
        }

        console.error('[PDF Route] Could not download file:', file.url, downloadError)
        return NextResponse.json({ error: "PDF not available" }, { status: 404 })
    } catch (error) {
        console.error("[PDF Route] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
