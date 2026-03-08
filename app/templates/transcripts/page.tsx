import { Metadata } from 'next'
import Transcripts from '@/components/transcripts'

export const metadata: Metadata = {
    title: 'Transcripts | Wesley',
    description: 'Analyze deposition and trial transcripts',
}

export default function TranscriptsPage() {
    return <Transcripts />
}
