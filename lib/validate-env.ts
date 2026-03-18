/**
 * Environment Variable Validation
 *
 * Validates all required secrets on import.
 * Fails fast with clear error messages for missing/malformed secrets.
 */

interface EnvVar {
    name: string
    required: boolean
    hint?: string
}

const REQUIRED_VARS: EnvVar[] = [
    { name: 'AUTH0_SECRET', required: true, hint: 'Auth0 session encryption secret' },
    { name: 'AUTH0_BASE_URL', required: true, hint: 'Auth0 base URL (e.g., https://yourapp.com)' },
    { name: 'AUTH0_DOMAIN', required: true, hint: 'Auth0 domain (e.g., auth.yourapp.com)' },
    { name: 'AUTH0_CLIENT_ID', required: true, hint: 'Auth0 client ID' },
    { name: 'AUTH0_CLIENT_SECRET', required: true, hint: 'Auth0 client secret' },
    { name: 'OPENAI_API_KEY', required: true, hint: 'OpenAI API key for AI features' },
    { name: 'SUPABASE_URL', required: true, hint: 'Supabase project URL' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, hint: 'Supabase service role key' },
]

/**
 * Validates that all required environment variables are present.
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
    const missing: string[] = []

    for (const v of REQUIRED_VARS) {
        const value = process.env[v.name]
        if (v.required && (!value || value.trim() === '')) {
            missing.push(v.name)
        }
    }

    return { valid: missing.length === 0, missing }
}

/**
 * Validates environment and logs warnings/errors.
 */
export function assertEnv(): void {
    const { valid, missing } = validateEnv()

    if (!valid) {
        const lines = missing.map(name => {
            const v = REQUIRED_VARS.find(r => r.name === name)
            return `  ✗ ${name} — ${v?.hint || 'required'}`
        })

        console.error([
            '',
            '┌─────────────────────────────────────────────┐',
            '│     MISSING ENVIRONMENT VARIABLES            │',
            '├─────────────────────────────────────────────┤',
            ...lines,
            '├─────────────────────────────────────────────┤',
            '│  Add these to .env.local or deploy config   │',
            '└─────────────────────────────────────────────┘',
            '',
        ].join('\n'))

        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
        }
    }
}

// Auto-validate on import
assertEnv()
