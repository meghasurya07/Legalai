import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { downloadTextFile } from '@/lib/download'

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

describe('downloadTextFile', () => {
    let clickSpy: () => void
    let anchorElement: Record<string, unknown>

    beforeEach(() => {
        clickSpy = vi.fn()
        anchorElement = { href: '', download: '', click: clickSpy }

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { })
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
        vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
        vi.spyOn(document, 'createElement').mockReturnValue(anchorElement as unknown as HTMLAnchorElement)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('creates a blob and object URL', () => {
        downloadTextFile('hello', 'file.txt', 'text/plain')
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('defaults to text/plain mime type', () => {
        downloadTextFile('content', 'output.txt')
        expect(URL.createObjectURL).toHaveBeenCalled()
    })

    it('sets the download filename on the anchor element', () => {
        downloadTextFile('x', 'report.md')
        expect(anchorElement.download).toBe('report.md')
    })

    it('triggers click, cleans up, and revokes object URL', () => {
        downloadTextFile('data', 'test.txt')
        expect(clickSpy).toHaveBeenCalledTimes(1)
        expect(document.body.appendChild).toHaveBeenCalledTimes(1)
        expect(document.body.removeChild).toHaveBeenCalledTimes(1)
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('shows a success toast with the filename', async () => {
        const { toast } = await import('sonner')
        downloadTextFile('test', 'report.pdf')
        expect(toast.success).toHaveBeenCalledWith('Downloaded report.pdf')
    })
})
