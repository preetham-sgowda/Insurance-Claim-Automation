import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Authenticated user shape attached to req.user by authMiddleware.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'claimant' | 'agent' | 'admin';
  fullName?: string;
}

// Extend Express Request to include our user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Express middleware that verifies Supabase-issued JWTs.
 * 
 * Expects: Authorization: Bearer <supabase_access_token>
 * 
 * On success: attaches req.user with { id, email, role, fullName }
 * On failure: returns 401
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Provide Authorization: Bearer <token>',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  // Check if this is a mock token (used when Supabase is not configured)
  if (token.startsWith('mock-token-for-')) {
    try {
      const parts = token.slice('mock-token-for-'.length).split('-');
      const role = (parts[0] || 'claimant') as AuthenticatedUser['role'];
      const id = parts[1] || 'mock-user-id';
      const fullName = parts[2] ? decodeURIComponent(parts[2]) : 'Mock User';

      req.user = {
        id,
        email: `${id}@claimx-mock.in`,
        role,
        fullName
      };

      next();
      return;
    } catch (err: any) {
      console.warn('Failed to parse mock token:', err.message);
    }
  }

  try {
    // Verify the JWT and get the authenticated user from Supabase Auth
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      res.status(401).json({
        error: 'Invalid or expired authentication token.',
        details: authError?.message,
      });
      return;
    }

    // Look up the user's role from public.users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', authUser.id)
      .maybeSingle();

    if (dbError) {
      console.error('Failed to fetch user profile from public.users:', dbError.message);
    }

    // Attach authenticated user to request
    req.user = {
      id: authUser.id,
      email: authUser.email || dbUser?.email || '',
      role: (dbUser?.role as AuthenticatedUser['role']) || 'claimant',
      fullName: dbUser?.full_name || authUser.user_metadata?.full_name || undefined,
    };

    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err?.message || err);
    res.status(401).json({
      error: 'Authentication failed.',
      details: err?.message,
    });
  }
}

/**
 * Higher-order middleware that restricts access to specific roles.
 * Must be used AFTER authMiddleware.
 * 
 * Usage: app.get('/api/admin/...', authMiddleware, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles: AuthenticatedUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}
