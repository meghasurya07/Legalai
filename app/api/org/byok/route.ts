import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { canManage } from '@/lib/permissions'
import {
    encryptKey,
    generateKeyHint,
    validateOpenAIKey,
    validateAzureKey,
    invalidateBYOKCache
} from '@/lib/byok'

// ── GET /api/org/byok — Get BYOK status for the org ─────────────────
export async function GET() {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        if (!canManage(ctx.role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

        const { data, error } = await supabase
            .from('organizations')
            .select('byok_provider, byok_key_hint, azure_endpoint, azure_deployment')
            .eq('id', ctx.orgId)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                provider: data.byok_provider || 'none',
                keyHint: data.byok_key_hint || null,
                azureEndpoint: data.azure_endpoint || null,
                azureDeployment: data.azure_deployment || null,
            }
        })
    } catch (error) {
        console.error('[BYOK GET] Error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// ── POST /api/org/byok — Set/update BYOK key ────────────────────────
export async function POST(request: NextRequest) {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        if (!canManage(ctx.role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

        const body = await request.json()
        const { provider, apiKey, azureEndpoint, azureDeployment } = body

        // Validate provider
        if (!provider || !['openai', 'azure_openai'].includes(provider)) {
            return NextResponse.json({ success: false, error: 'Invalid provider. Must be "openai" or "azure_openai".' }, { status: 400 })
        }

        // Validate required fields
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            return NextResponse.json({ success: false, error: 'A valid API key is required.' }, { status: 400 })
        }

        if (provider === 'azure_openai') {
            if (!azureEndpoint || typeof azureEndpoint !== 'string') {
                return NextResponse.json({ success: false, error: 'Azure endpoint URL is required.' }, { status: 400 })
            }
            if (!azureDeployment || typeof azureDeployment !== 'string') {
                return NextResponse.json({ success: false, error: 'Azure deployment name is required.' }, { status: 400 })
            }
            // Validate URL format
            try {
                new URL(azureEndpoint)
            } catch {
                return NextResponse.json({ success: false, error: 'Invalid Azure endpoint URL format.' }, { status: 400 })
            }
        }

        // Validate the key against the provider BEFORE encrypting/saving
        let validation
        if (provider === 'openai') {
            validation = await validateOpenAIKey(apiKey.trim())
        } else {
            validation = await validateAzureKey(apiKey.trim(), azureEndpoint, azureDeployment)
        }

        if (!validation.valid) {
            return NextResponse.json({
                success: false,
                error: validation.error || 'API key validation failed.'
            }, { status: 400 })
        }

        // Encrypt the key
        const encrypted = encryptKey(apiKey.trim())
        const keyHint = generateKeyHint(apiKey.trim())

        // Update the organization
        const updateData: Record<string, unknown> = {
            byok_provider: provider,
            encrypted_api_key: encrypted,
            byok_key_hint: keyHint,
            azure_endpoint: provider === 'azure_openai' ? azureEndpoint : null,
            azure_deployment: provider === 'azure_openai' ? azureDeployment : null,
            updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('organizations')
            .update(updateData)
            .eq('id', ctx.orgId)

        if (updateError) {
            console.error('[BYOK POST] Update error:', updateError)
            return NextResponse.json({ success: false, error: 'Failed to save API key.' }, { status: 500 })
        }

        // Invalidate the cache so the new key is used immediately
        invalidateBYOKCache(ctx.orgId)

        // Audit log
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'byok_key_set',
            target_entity: 'organization',
            target_id: ctx.orgId,
            metadata: { provider, key_hint: keyHint }
        })

        return NextResponse.json({
            success: true,
            data: {
                provider,
                keyHint,
                azureEndpoint: provider === 'azure_openai' ? azureEndpoint : null,
                azureDeployment: provider === 'azure_openai' ? azureDeployment : null,
            }
        })
    } catch (error) {
        console.error('[BYOK POST] Error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// ── DELETE /api/org/byok — Remove BYOK key (revert to Wesley) ───────
export async function DELETE() {
    try {
        const ctx = await getOrgContext()
        if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        if (!canManage(ctx.role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

        const { error: updateError } = await supabase
            .from('organizations')
            .update({
                byok_provider: 'none',
                encrypted_api_key: null,
                byok_key_hint: null,
                azure_endpoint: null,
                azure_deployment: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', ctx.orgId)

        if (updateError) {
            console.error('[BYOK DELETE] Update error:', updateError)
            return NextResponse.json({ success: false, error: 'Failed to remove API key.' }, { status: 500 })
        }

        // Invalidate cache
        invalidateBYOKCache(ctx.orgId)

        // Audit log
        await supabase.from('audit_log').insert({
            org_id: ctx.orgId,
            actor_user_id: ctx.userId,
            action: 'byok_key_removed',
            target_entity: 'organization',
            target_id: ctx.orgId,
            metadata: {}
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[BYOK DELETE] Error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
