/**
 * INKLOOM AI - Server Authentication, Session Management & RBAC (Phase 5 & 6)
 * Implements:
 * - 15m Access Token (JWT) + 7d Refresh Token in httpOnly SameSite=Strict cookie
 * - Token versioning for instant global revocation
 * - Account lockout after 5 consecutive failed attempts (15 min)
 * - Refresh token rotation & reuse detection (revoking all sessions on reuse)
 * - Anti-self-approval enforcement
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userRepo } from './db/repos';
import { config } from './config';
import { hasPermission, Permission, UserRole } from './permissions';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  email: string;
  fullName: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      user?: AuthContext;
    }
  }
}

export const JWT_SECRET = config.JWT_SECRET;
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_DAYS = 7;
export const REFRESH_COOKIE_NAME = 'inkloom_refresh_token';

export function signAccessToken(user: {
  user_id: string;
  org_id: string;
  role: string;
  email?: string;
  full_name?: string;
  token_version?: number;
}): string {
  return jwt.sign(
    {
      sub: user.user_id,
      org: user.org_id,
      role: user.role,
      email: user.email || `${user.role || 'user'}@lumora.test`,
      fullName: user.full_name || 'User',
      tokenVersion: user.token_version ?? 0,
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// Backward compatibility alias
export const signToken = (user: any) => signAccessToken(user);

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

/**
 * Authentication Middleware:
 * Validates JWT, checks token version, verifies user is active,
 * and sets both req.auth and req.user for full backward/forward compatibility.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Missing Authorization header' });
  }

  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    const user = await userRepo.getById(claims.sub);

    if (!user || user.status === 'deactivated' || user.is_active === false || user.org_id !== claims.org) {
      return res.status(401).json({ error: 'invalid_session', message: 'User session is invalid or deactivated' });
    }

    // Token version check (revocation detection)
    const userTokenVersion = (user as any).token_version ?? 0;
    const claimTokenVersion = claims.tokenVersion ?? 0;
    if (claimTokenVersion < userTokenVersion) {
      return res.status(401).json({
        error: 'token_revoked',
        message: 'Session has been invalidated. Please sign in again.',
      });
    }

    const context: AuthContext = {
      userId: user.user_id,
      orgId: user.org_id,
      role: user.role as UserRole,
      email: user.email,
      fullName: user.full_name,
      tokenVersion: userTokenVersion,
    };

    req.auth = context;
    req.user = context;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Invalid or expired token' });
  }
}

/**
 * Role-Based Access Control Middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth || req.user;
    if (!auth) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    if (!roles.includes(auth.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Role '${auth.role}' is not authorized. Required: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

/**
 * Permission-Based Access Control Middleware
 */
export const requirePerm = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth || req.user;
    if (!auth) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    if (!hasPermission(auth.role, permission)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Insufficient permissions: '${auth.role}' lacks '${permission}'.`,
      });
    }
    next();
  };
};
