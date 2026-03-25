import { auth0 } from '@/lib/auth0';

const ROLE_NAMESPACE = 'https://askwesley.com/roles';

/**
 * Server-side utility to extract Auth0 user roles injected via Actions.
 * Always returns an array of strings.
 */
export async function getUserRoles(): Promise<string[]> {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return [];

    const roles = session.user[ROLE_NAMESPACE];
    
    if (Array.isArray(roles)) {
      return roles;
    }
    
    // Fallback if it comes through as a string for some reason
    if (typeof roles === 'string') {
        return [roles];
    }

    return [];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
}

/**
 * Server-side check specifically for the FIRM_ADMIN role.
 */
export async function isFirmAdmin(): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes('FIRM_ADMIN');
}
