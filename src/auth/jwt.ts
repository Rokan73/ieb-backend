import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser } from '../types';

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  type: 'access' | 'refresh';
}

export function signAccessToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    type: 'access',
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    type: 'refresh',
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
  return decoded;
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}
