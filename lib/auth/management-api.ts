/**
 * Server-side utility to interact with the Auth0 Management API.
 * This securely exchanges your M2M credentials for an access token.
 */
import { logger } from '@/lib/logger'

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getManagementApiToken(): Promise<string> {
  // Return cached token if still valid (with a 60-second buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_M2M_CLIENT_ID;
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET;
  
  // Custom Domains (e.g. auth.askwesley.com) cannot be used as the Management API identifier. 
  // It strictly requires the canonical Auth0 tenant domain identifier.
  const audience = process.env.AUTH0_MGMT_AUDIENCE || 'https://dev-ufv0u4i2gq8sr7b1.us.auth0.com/api/v2/';

  if (!domain || !clientId || !clientSecret) {
    throw new Error('Missing Auth0 M2M credentials in environment variables.');
  }

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: audience,
      grant_type: 'client_credentials'
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Management API Token Error:', 'Error occurred', errorBody);
    throw new Error(`Failed to obtain Management API token: ${response.statusText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken!;
}

/**
 * Returns the canonical Auth0 tenant base URL for Management API v2 calls.
 * Custom domains (e.g. auth.askwesley.com) CANNOT be used for the Management API.
 * This extracts the correct domain from AUTH0_MGMT_AUDIENCE.
 */
export function getManagementApiBaseUrl(): string {
  const audience = process.env.AUTH0_MGMT_AUDIENCE || 'https://dev-ufv0u4i2gq8sr7b1.us.auth0.com/api/v2/';
  // audience is like "https://dev-xxx.us.auth0.com/api/v2/"
  // We need "https://dev-xxx.us.auth0.com"
  try {
    const url = new URL(audience);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return 'https://dev-ufv0u4i2gq8sr7b1.us.auth0.com';
  }
}
