import {
    FileText,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileJson,
    FileArchive,
    File,
    Video,
    Music
} from "lucide-react"

interface FileIconProps {
    filename: string
    className?: string
}

export function FileIcon({ filename, className = "h-4 w-4" }: FileIconProps) {
    const extension = filename.split('.').pop()?.toLowerCase() || ''

    switch (extension) {
        case 'pdf':
            return <FileText className={`${className} text-red-500`} />
        case 'doc':
        case 'docx':
            return <FileText className={`${className} text-blue-500`} />
        case 'txt':
        case 'md':
        case 'rtf':
            return <FileText className={`${className} text-gray-500`} />
        case 'xls':
        case 'xlsx':
        case 'csv':
            return <FileSpreadsheet className={`${className} text-green-500`} />
        case 'ppt':
        case 'pptx':
            return <FilePresentation className={`${className} text-orange-500`} />
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
        case 'webp':
            return <FileImage className={`${className} text-purple-500`} />
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'html':
        case 'css':
            return <FileCode className={`${className} text-yellow-500`} />
        case 'json':
            return <FileJson className={`${className} text-yellow-500`} />
        case 'xml':
            return <FileCode className={`${className} text-yellow-500`} />
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
            return <FileArchive className={`${className} text-orange-400`} />
        case 'mp4':
        case 'mov':
        case 'avi':
            return <Video className={`${className} text-pink-500`} />
        case 'mp3':
        case 'wav':
        case 'ogg':
            return <Music className={`${className} text-indigo-500`} />
        default:
            return <File className={`${className} text-gray-400`} />
    }
}

// Fallback for missing icons in older Lucide versions
function FilePresentation({ className }: { className?: string }) {
    return <FileText className={className} />
}
