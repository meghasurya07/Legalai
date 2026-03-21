import { NextRequest, NextResponse } from "next/server"
import { auth0 } from "@/lib/auth0"
import { supabase } from "@/lib/supabase/server"

/**
 * GET /api/documents/[fileId]/text
 * 
 * Returns the extracted text for a given file ID.
 * Used by the citation viewer to display non-PDF documents
 * with text highlighting.
 * Requires authentication.
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

        // Fetch extracted text from the files table
        const { data: file, error } = await supabase
            .from('files')
            .select('id, name, extracted_text')
            .eq('id', fileId)
            .single()

        if (error || !file) {
            console.error('[Text API] File not found:', error)
            return NextResponse.json({ error: "File not found" }, { status: 404 })
        }

        return NextResponse.json({
            text: file.extracted_text || '',
            fileName: file.name,
        })
    } catch (err) {
        console.error('[Text API] Error:', err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
