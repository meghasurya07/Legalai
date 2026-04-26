import type OpenAI from 'openai'
import type { Attachment } from '@/types'

export interface ChatFileInput {
    id?: string
    name: string
    type?: Attachment['type'] | string
    mimeType?: string
    source?: Attachment['source'] | string
    url?: string
    storageUrl?: string
    content?: string | null
}

export interface ChatImageInput {
    name: string
    url: string
}

export function isImageFileInput(file: ChatFileInput): boolean {
    const mimeType = file.mimeType || (typeof file.type === 'string' && file.type.startsWith('image/') ? file.type : '')
    return file.type === 'image' || mimeType.startsWith('image/')
}

function isModelReadableImageUrl(url: string): boolean {
    return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')
}

export function getImageInputsFromFiles(files?: ChatFileInput[]): ChatImageInput[] {
    if (!Array.isArray(files)) return []

    return files.flatMap((file) => {
        if (!isImageFileInput(file) || !file.url || !isModelReadableImageUrl(file.url)) return []
        return [{ name: file.name, url: file.url }]
    })
}

export function prepareFilesForTextContext(files?: ChatFileInput[]): ChatFileInput[] | undefined {
    if (!Array.isArray(files)) return files

    return files.map((file) => {
        if (!isImageFileInput(file)) return file

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { content, ...metadataOnlyFile } = file
        return metadataOnlyFile
    })
}

export function buildChatCompletionUserContent(
    finalUserPrompt: string,
    imageInputs: ChatImageInput[]
): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
    if (imageInputs.length === 0) return finalUserPrompt

    return [
        { type: 'text', text: finalUserPrompt },
        ...imageInputs.map((image) => ({
            type: 'image_url' as const,
            image_url: {
                url: image.url,
                detail: 'auto' as const,
            },
        })),
    ]
}

export function buildResponsesUserContent(
    finalUserPrompt: string,
    imageInputs: ChatImageInput[]
): string | OpenAI.Responses.ResponseInputMessageContentList {
    if (imageInputs.length === 0) return finalUserPrompt

    return [
        { type: 'input_text', text: finalUserPrompt },
        ...imageInputs.map((image) => ({
            type: 'input_image' as const,
            image_url: image.url,
            detail: 'auto' as const,
        })),
    ]
}
