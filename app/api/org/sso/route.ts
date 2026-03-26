import { NextResponse } from 'next/server';
import { getManagementApiToken, getManagementApiBaseUrl } from '@/lib/auth/management-api';
import { isFirmAdmin } from '@/lib/auth/get-user-role';

// Helper to format the connection name consistently
function getConnectionName(domain: string) {
  return `saml-${domain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export async function GET(request: Request) {
  try {
    const hasAccess = await isFirmAdmin();
    if (!hasAccess) return new NextResponse("Unauthorized", { status: 403 });

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    if (!domain) return new NextResponse("Domain is required", { status: 400 });

    const token = await getManagementApiToken();
    const baseUrl = getManagementApiBaseUrl();
    const connectionName = getConnectionName(domain);

    // Fetch connection by name — MUST use canonical tenant domain, NOT custom domain
    const res = await fetch(`${baseUrl}/api/v2/connections?name=${connectionName}&strategy=samlp`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    
    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[SSO GET] Management API error:", res.status, errorBody);
      return NextResponse.json({ error: 'Failed to query SSO status' }, { status: 502 });
    }
    
    const connections = await res.json();
    if (connections.length === 0) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ exists: true, connection: connections[0] });
  } catch (error) {
    console.error("SSO GET Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const hasAccess = await isFirmAdmin();
    if (!hasAccess) return new NextResponse("Unauthorized", { status: 403 });

    const body = await request.json();
    const { domain, signInEndpoint, cert } = body;

    if (!domain || !signInEndpoint || !cert) {
      return NextResponse.json({ error: 'Missing required fields: domain, signInEndpoint, cert' }, { status: 400 });
    }

    const token = await getManagementApiToken();
    const baseUrl = getManagementApiBaseUrl();
    const connectionName = getConnectionName(domain);
    const clientId = process.env.AUTH0_CLIENT_ID;

    if (!clientId) {
      console.error("[SSO POST] AUTH0_CLIENT_ID is missing from environment variables");
      return NextResponse.json({ error: 'Server configuration error: missing AUTH0_CLIENT_ID' }, { status: 500 });
    }

    // First check if it exists — MUST use canonical tenant domain
    const getRes = await fetch(`${baseUrl}/api/v2/connections?name=${connectionName}&strategy=samlp`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    if (!getRes.ok) {
      const errorBody = await getRes.text();
      console.error("[SSO POST] Failed to check existing connection:", errorBody);
      return NextResponse.json({ error: 'Failed to check existing SSO configuration' }, { status: 502 });
    }

    const existing = await getRes.json();

    const payload = {
      options: {
        signInEndpoint,
        signingCert: cert,
        domain_aliases: [domain.toLowerCase()],
        tenant_domain: domain.toLowerCase()
      }
    };

    if (existing.length > 0) {
      // Update existing connection
      const connId = existing[0].id;
      const patchRes = await fetch(`${baseUrl}/api/v2/connections/${connId}`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!patchRes.ok) {
        const errorBody = await patchRes.text();
        console.error("[SSO POST] Failed to update connection:", errorBody);
        return NextResponse.json({ error: 'Failed to update SSO connection' }, { status: 502 });
      }
      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Create new connection
      const postRes = await fetch(`${baseUrl}/api/v2/connections`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: connectionName,
          strategy: 'samlp',
          enabled_clients: [clientId],
          ...payload
        })
      });
      if (!postRes.ok) {
        const errorBody = await postRes.text();
        console.error("[SSO POST] Auth0 Create Connection Error:", errorBody);
        return NextResponse.json({ error: 'Failed to create SSO connection' }, { status: 502 });
      }
      return NextResponse.json({ success: true, action: 'created' });
    }
  } catch (error) {
    console.error("SSO POST Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const hasAccess = await isFirmAdmin();
    if (!hasAccess) return new NextResponse("Unauthorized", { status: 403 });

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    if (!domain) return new NextResponse("Domain is required", { status: 400 });

    const token = await getManagementApiToken();
    const baseUrl = getManagementApiBaseUrl();
    const connectionName = getConnectionName(domain);

    // Get connection ID — MUST use canonical tenant domain
    const getRes = await fetch(`${baseUrl}/api/v2/connections?name=${connectionName}&strategy=samlp`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    if (!getRes.ok) {
      const errorBody = await getRes.text();
      console.error("[SSO DELETE] Failed to fetch connection:", errorBody);
      return NextResponse.json({ error: 'Failed to query SSO connection' }, { status: 502 });
    }

    const existing = await getRes.json();

    if (existing.length > 0) {
      const connId = existing[0].id;
      const delRes = await fetch(`${baseUrl}/api/v2/connections/${connId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!delRes.ok) {
        const errorBody = await delRes.text();
        console.error("[SSO DELETE] Failed to delete connection:", errorBody);
        return NextResponse.json({ error: 'Failed to delete SSO connection' }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SSO DELETE Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
