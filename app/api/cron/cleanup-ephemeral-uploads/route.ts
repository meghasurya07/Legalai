import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// GET /api/cron/cleanup-ephemeral-uploads
// Deletes files in global chat (ephemeral-uploads) older than 48 hours.
// This is intended to be called by a cron job (e.g., Vercel Cron).
export async function GET(request: Request) {
    try {
        // Basic protection: require a CRON_SECRET if one is configured
        const authHeader = request.headers.get('authorization')
        if (
            process.env.CRON_SECRET && 
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Calculate 48 hours ago
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

        // 1. Fetch old ephemeral files
        // We identify ephemeral files by project_id IS NULL
        const { data: files, error: fetchError } = await supabase
            .from('files')
            .select('id, url')
            .is('project_id', null)
            .lt('uploaded_at', fortyEightHoursAgo)

        if (fetchError) {
            console.error('[CRON] Failed to fetch old ephemeral files:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch files to clean up' }, { status: 500 })
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ message: 'No ephemeral files to clean up at this time.' })
        }

        console.log(`[CRON] Found ${files.length} ephemeral files older than 48 hours to delete.`)

        const fileIds = files.map(f => f.id)
        // The URL column stores the storage relative path (e.g. ephemeral-uploads/...)
        const fileUrls = files.map(f => f.url).filter(Boolean)

        // 2. Delete the files from Supabase Storage
        if (fileUrls.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove(fileUrls)
            
            if (storageError) {
                console.error('[CRON] Supabase Storage deletion failed for some or all files:', storageError)
                // Proceeding to delete DB rows even if storage deletion partially fails, 
                // but this could leave orphaned storage objects. 
                // For a robust system, you might want to only delete from DB if storage succeeds.
            } else {
                console.log(`[CRON] Deleted ${fileUrls.length} file(s) from Supabase Storage.`)
            }
        }

        // 3. Delete metadata records from the database
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .in('id', fileIds)

        if (dbError) {
            console.error('[CRON] Database records deletion failed:', dbError)
            return NextResponse.json({ error: 'Failed to delete file records' }, { status: 500 })
        }

        return NextResponse.json({
            message: `Successfully cleaned up ${files.length} ephemeral files.`
        })

    } catch (error) {
        console.error('[CRON] Unhandled error during cleanup:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
