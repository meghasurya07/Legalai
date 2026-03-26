/**
 * BYOK (Bring Your Own Key) — Encryption, Decryption & Key Resolution
 *
 * This module handles:
 * 1. AES-256-GCM encryption/decryption of API keys at rest
 * 2. Resolving the correct OpenAI client for a given organization
 * 3. Validating API keys before saving
 *
 * SECURITY NOTES:
 * - Raw keys are NEVER logged or stored in plaintext
 * - Encryption key comes from BYOK_ENCRYPTION_KEY env var (32-byte hex)
 * - Each encrypted blob includes a unique IV (nonce) for semantic security
 */

import OpenAI from 'openai'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase/server'

// ── Encryption Constants ────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const hex = process.env.BYOK_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) {
        throw new Error('BYOK_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    }
    return Buffer.from(hex, 'hex')
}

// ── Encrypt / Decrypt ───────────────────────────────────────────────

/**
 * Encrypts a raw API key using AES-256-GCM.
 * Returns a base64 string containing: IV + ciphertext + authTag
 */
export function encryptKey(rawKey: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

    const encrypted = Buffer.concat([
        cipher.update(rawKey, 'utf8'),
        cipher.final()
    ])

    const authTag = cipher.getAuthTag()

    // Pack: IV (12) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted])
    return packed.toString('base64')
}

/**
 * Decrypts an encrypted API key.
 * Expects the base64 format from encryptKey(): IV + authTag + ciphertext
 */
export function decryptKey(encryptedBase64: string): string {
    const key = getEncryptionKey()
    const packed = Buffer.from(encryptedBase64, 'base64')

    const iv = packed.subarray(0, IV_LENGTH)
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ])

    return decrypted.toString('utf8')
}

// ── Key Hint ────────────────────────────────────────────────────────

/**
 * Generates a safe display hint for an API key.
 * e.g., "sk-...a1b2" or "abc...wxyz"
 */
export function generateKeyHint(rawKey: string): string {
    if (rawKey.length < 8) return '****'
    const prefix = rawKey.slice(0, 3)
    const suffix = rawKey.slice(-4)
    return `${prefix}...${suffix}`
}

// ── Key Validation ──────────────────────────────────────────────────

interface ValidationResult {
    valid: boolean
    error?: string
}

/**
 * Validates an OpenAI API key by making a lightweight /v1/models request.
 */
export async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
    try {
        const client = new OpenAI({ apiKey, timeout: 10000 })
        // Lightweight call — just list models (costs nothing)
        await client.models.list()
        return { valid: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message.includes('401') || message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
            return { valid: false, error: 'Invalid API key. Please check and try again.' }
        }
        if (message.includes('429')) {
            return { valid: false, error: 'API key is rate-limited. Please try again later.' }
        }
        if (message.includes('insufficient_quota')) {
            return { valid: false, error: 'API key has no remaining quota.' }
        }
        return { valid: false, error: `Validation failed: ${message}` }
    }
}

/**
 * Validates an Azure OpenAI key by making a test request to the deployment.
 */
export async function validateAzureKey(apiKey: string, endpoint: string, deployment: string): Promise<ValidationResult> {
    try {
        const client = new OpenAI({
            apiKey,
            baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
            defaultQuery: { 'api-version': '2024-08-01-preview' },
            defaultHeaders: { 'api-key': apiKey },
            timeout: 10000
        })
        // Test with a minimal completion
        await client.chat.completions.create({
            model: deployment,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
        })
        return { valid: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message.includes('401') || message.includes('Access denied') || message.includes('invalid')) {
            return { valid: false, error: 'Invalid Azure API key or endpoint.' }
        }
        if (message.includes('404') || message.includes('DeploymentNotFound')) {
            return { valid: false, error: `Deployment "${deployment}" not found at this endpoint.` }
        }
        return { valid: false, error: `Azure validation failed: ${message}` }
    }
}

// ── Client Resolution ───────────────────────────────────────────────

interface BYOKConfig {
    byok_provider: string
    encrypted_api_key: string | null
    azure_endpoint: string | null
    azure_deployment: string | null
}

// Cache org configs for 5 minutes to avoid DB hits on every request
const configCache = new Map<string, { config: BYOKConfig; expiry: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

async function getOrgBYOKConfig(orgId: string): Promise<BYOKConfig | null> {
    // Check cache
    const cached = configCache.get(orgId)
    if (cached && cached.expiry > Date.now()) {
        return cached.config
    }

    const { data, error } = await supabase
        .from('organizations')
        .select('byok_provider, encrypted_api_key, azure_endpoint, azure_deployment')
        .eq('id', orgId)
        .single()

    if (error || !data) return null

    const config = data as BYOKConfig
    configCache.set(orgId, { config, expiry: Date.now() + CACHE_TTL_MS })
    return config
}

/**
 * Invalidates the cached BYOK config for an organization.
 * Call this after updating BYOK settings.
 */
export function invalidateBYOKCache(orgId: string): void {
    configCache.delete(orgId)
}

/**
 * Resolves the correct OpenAI client for the given organization.
 *
 * Priority:
 * 1. If org has BYOK enabled → use their encrypted key
 * 2. Otherwise → use Wesley's system key (process.env.OPENAI_API_KEY)
 *
 * @param orgId - The organization ID (optional). If not provided, uses system key.
 * @param options - Additional OpenAI client options (e.g., timeout for deep research)
 */
export async function resolveOpenAIClient(
    orgId?: string | null,
    options?: { timeout?: number }
): Promise<OpenAI> {
    // Default: use Wesley's system key
    const systemKey = process.env.OPENAI_API_KEY
    if (!systemKey) {
        throw new Error('AI service is not configured. Please contact support.')
    }

    // If no org context, use system key
    if (!orgId) {
        return new OpenAI({ apiKey: systemKey, ...options })
    }

    // Check org BYOK config
    const config = await getOrgBYOKConfig(orgId)
    if (!config || config.byok_provider === 'none' || !config.encrypted_api_key) {
        return new OpenAI({ apiKey: systemKey, ...options })
    }

    // Decrypt the org's key — NEVER silently fall back to system key
    let decryptedKey: string
    try {
        decryptedKey = decryptKey(config.encrypted_api_key)
    } catch {
        console.error(`[BYOK] CRITICAL: Failed to decrypt key for org ${orgId}`)
        throw new Error(
            'Your organization\'s API key could not be decrypted. ' +
            'Please contact your administrator to re-enter the API key in Organization Settings → API Keys.'
        )
    }

    // Return the appropriate client
    if (config.byok_provider === 'azure_openai' && config.azure_endpoint) {
        const deployment = config.azure_deployment || 'gpt-4o'
        return new OpenAI({
            apiKey: decryptedKey,
            baseURL: `${config.azure_endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
            defaultQuery: { 'api-version': '2024-08-01-preview' },
            defaultHeaders: { 'api-key': decryptedKey },
            ...options
        })
    }

    // Standard OpenAI
    return new OpenAI({ apiKey: decryptedKey, ...options })
}
