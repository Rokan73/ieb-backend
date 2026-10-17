import { extractBearerToken, verifyToken } from '../auth/jwt';
import { AuthUser } from '../types';
import { error, jsonResponse } from '../utils/response';

export function getAuthUser(event: {
  headers: Record<string, string | undefined>;
}): AuthUser | null {
  const authHeader =
    event.headers['authorization'] ||
    event.headers['Authorization'] ||
    event.headers['AUTHORIZATION'];
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') return null;
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };
  } catch {
    return null;
  }
}

export function requireAuth(event: {
  headers: Record<string, string | undefined>;
}): AuthUser | ReturnType<typeof jsonResponse> {
  const user = getAuthUser(event);
  if (!user) {
    return jsonResponse(error('Authentication required', undefined, 'UNAUTHORIZED'), 401);
  }
  return user;
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.roles.includes('super_admin')) return true;
  return user.permissions.includes(permission) || user.permissions.includes('*');
}

export function hasAnyRole(user: AuthUser, roles: string[]): boolean {
  if (user.roles.includes('super_admin')) return true;
  return roles.some((r) => user.roles.includes(r));
}

export function requirePermission(
  user: AuthUser,
  permission: string
): true | ReturnType<typeof jsonResponse> {
  if (!hasPermission(user, permission)) {
    return jsonResponse(error('Insufficient permissions', undefined, 'FORBIDDEN'), 403);
  }
  return true;
}

export function requireRoles(
  user: AuthUser,
  roles: string[]
): true | ReturnType<typeof jsonResponse> {
  if (!hasAnyRole(user, roles)) {
    return jsonResponse(error('Insufficient role privileges', undefined, 'FORBIDDEN'), 403);
  }
  return true;
}
