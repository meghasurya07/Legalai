import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptKey, decryptKey, generateKeyHint } from '@/lib/byok'

// Provide a deterministic 32-byte encryption key for tests
const TEST_KEY_HEX = 'a'.repeat(64) // 32 bytes of 0xAA

beforeEach(() => {
    vi.stubEnv('BYOK_ENCRYPTION_KEY', TEST_KEY_HEX)
})

afterEach(() => {
    vi.unstubAllEnvs()
})

// ─── Encrypt / Decrypt Round-Trip ───────────────────────────────

describe('encryptKey + decryptKey', () => {
    it('round-trips a standard OpenAI key', () => {
        const raw = 'sk-abc123def456ghi789jkl012mno345pqr678stu901vwx'
        const encrypted = encryptKey(raw)
        const decrypted = decryptKey(encrypted)
        expect(decrypted).toBe(raw)
    })

    it('round-trips an empty string', () => {
        const encrypted = encryptKey('')
        expect(decryptKey(encrypted)).toBe('')
    })

    it('round-trips keys with special characters', () => {
        const raw = 'sk-proj_with-special.chars/and=padding+more'
        expect(decryptKey(encryptKey(raw))).toBe(raw)
    })

    it('produces different ciphertext each time (unique IV)', () => {
        const raw = 'sk-same-key-every-time'
        const a = encryptKey(raw)
        const b = encryptKey(raw)
        expect(a).not.toBe(b) // Different IVs → different ciphertext
        // But both decrypt to the same value
        expect(decryptKey(a)).toBe(raw)
        expect(decryptKey(b)).toBe(raw)
    })

    it('throws on tampered ciphertext', () => {
        const raw = 'sk-tamper-test'
        const encrypted = encryptKey(raw)
        // Flip a character in the middle of the base64 blob
        const tampered = encrypted.slice(0, 20) + 'X' + encrypted.slice(21)
        expect(() => decryptKey(tampered)).toThrow()
    })
})

// ─── encryptKey without env key ─────────────────────────────────

describe('encryptKey without BYOK_ENCRYPTION_KEY', () => {
    it('throws when encryption key is missing', () => {
        vi.stubEnv('BYOK_ENCRYPTION_KEY', '')
        expect(() => encryptKey('sk-test')).toThrow('BYOK_ENCRYPTION_KEY')
    })

    it('throws when encryption key is wrong length', () => {
        vi.stubEnv('BYOK_ENCRYPTION_KEY', 'tooshort')
        expect(() => encryptKey('sk-test')).toThrow('BYOK_ENCRYPTION_KEY')
    })
})

// ─── generateKeyHint ────────────────────────────────────────────

describe('generateKeyHint', () => {
    it('returns prefix...suffix for normal keys', () => {
        expect(generateKeyHint('sk-abc123456789xyz')).toBe('sk-...9xyz')
    })

    it('returns **** for very short keys', () => {
        expect(generateKeyHint('short')).toBe('****')
    })

    it('handles exactly 8 characters', () => {
        expect(generateKeyHint('12345678')).toBe('123...5678')
    })
})
