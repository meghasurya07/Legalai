import mammoth from 'mammoth'

/**
 * Shared text extraction utility for uploaded files.
 * Supports: DOCX, PDF, TXT, CSV, and generic text.
 */
export async function extractText(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const fileType = file.type
    const fileName = file.name.toLowerCase()

    console.log(`[extractText] Processing file: ${file.name}, type: ${fileType}, size: ${buffer.byteLength} bytes`)

    try {
        // DOCX
        if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
            console.log(`[extractText] Detected DOCX, using mammoth`)
            const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
            const text = result.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            console.log(`[extractText] DOCX extracted: ${text.length} chars`)
            return text
        }

        // PDF (pdf-parse v1 — import from lib directly to avoid index.js test file bug)
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            console.log(`[extractText] Detected PDF, using pdf-parse`)
            try {
                // @ts-expect-error - direct import to bypass index.js test file read
                const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
                const data = await pdfParse(Buffer.from(buffer))
                console.log(`[extractText] PDF extracted: ${data.text.length} chars`)
                return data.text
            } catch (pdfError) {
                console.error(`[extractText] PDF extraction error:`, pdfError)
                throw pdfError
            }
        }

        // Plain text, markdown, code files
        if (
            fileType === 'text/plain' ||
            fileType === 'text/csv' ||
            fileType === 'text/markdown' ||
            fileType === 'application/json' ||
            fileType === 'application/xml' ||
            fileType === 'text/xml' ||
            fileName.endsWith('.txt') ||
            fileName.endsWith('.md') ||
            fileName.endsWith('.csv') ||
            fileName.endsWith('.json') ||
            fileName.endsWith('.xml') ||
            fileName.endsWith('.rtf')
        ) {
            console.log(`[extractText] Detected text file`)
            const decoder = new TextDecoder()
            const text = decoder.decode(buffer)
            console.log(`[extractText] Text file extracted: ${text.length} chars`)
            return text
        }

        // HTML — strip tags for clean text (useful for legal research content)
        if (
            fileType === 'text/html' ||
            fileName.endsWith('.html') ||
            fileName.endsWith('.htm')
        ) {
            console.log(`[extractText] Detected HTML file, stripping tags`)
            const decoder = new TextDecoder()
            const html = decoder.decode(buffer)
            const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/\s+/g, ' ')
                .trim()
            console.log(`[extractText] HTML extracted: ${text.length} chars`)
            return text
        }

        // Reject known binary formats that can't be text-decoded
        const binaryExtensions = ['.xlsx', '.xls', '.pptx', '.ppt', '.doc', '.zip', '.rar',
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.mp3', '.mp4', '.wav', '.avi']
        if (binaryExtensions.some(ext => fileName.endsWith(ext))) {
            console.log(`[extractText] Binary file format not supported: ${file.name}`)
            return `[File: ${file.name} - Binary format not supported for text extraction]`
        }

        // Generic text attempt (for unknown text-based formats)
        console.log(`[extractText] No specific handler matched, trying generic text decode`)
        const decoder = new TextDecoder()
        const text = decoder.decode(buffer)
        if (text && text.length > 0) {
            console.log(`[extractText] Generic decode succeeded: ${text.length} chars`)
            return text
        }

        console.log(`[extractText] Could not extract text from binary file`)
        return `[File: ${file.name} - Binary content not extractable]`
    } catch (error) {
        console.error('[extractText] Error extracting text:', error)
        return `[Error extracting text from ${file.name}]`
    }
}
