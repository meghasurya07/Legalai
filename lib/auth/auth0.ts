import { logger } from '@/lib/logger'
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { decodeJwt } from 'jose';

export const auth0 = new Auth0Client({
  beforeSessionSaved: async (session, idToken) => {
    if (idToken) {
      try {
        const decoded = decodeJwt(idToken);
        const namespace = 'https://askwesley.com';
        
        if (decoded[`${namespace}/roles`]) {
            if (!session.user) session.user = { sub: decoded.sub || 'unknown' };
            Object.assign(session.user, { [`${namespace}/roles`]: decoded[`${namespace}/roles`] });
        }
        if (decoded[`${namespace}/debug`]) {
            if (!session.user) session.user = { sub: decoded.sub || 'unknown' };
            Object.assign(session.user, { [`${namespace}/debug`]: decoded[`${namespace}/debug`] });
        }
      } catch (e) {
        logger.error('Auth0 Claim Restore Failed', 'Error occurred', e);
      }
    }
    return session;
  }
});
