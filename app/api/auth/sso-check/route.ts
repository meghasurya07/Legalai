import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

/**
 * SSO Login Router
 * 
 * When the login page detects an SSO domain, it calls this endpoint with the email.
 * This returns the Auth0 connection name so the frontend can pass it as a
 * `connection` parameter to Auth0's /authorize endpoint, bypassing the 
 * universal login and going directly to the firm's IdP.
 * 
 * GET /api/auth/sso-check?email=user@firm.com
 */
export async function GET(request: NextRequest) {
    try {
        const email = request.nextUrl.searchParams.get('email')
        if (!email || !email.includes('@')) {
            return NextResponse.json({ sso: false })
        }

        const domain = email.split('@')[1].toLowerCase()

        // Check if this domain has an SSO org
        const { data: org } = await supabase
            .from('organizations')
            .select('id, name, sso_domain, status')
            .eq('sso_domain', domain)
            .eq('status', 'active')
            .limit(1)
            .single()

        if (!org) {
            return NextResponse.json({ sso: false })
        }

        // Return the connection name that Auth0 uses
        const connectionName = `saml-${domain.replace(/[^a-z0-9]/g, '-')}`

        return NextResponse.json({
            sso: true,
            connection: connectionName,
            org_name: org.name,
        })
    } catch {
        return NextResponse.json({ sso: false })
    }
}
