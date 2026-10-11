import bcrypt from 'bcryptjs';
import prisma from '../database/prisma';
import { signAccessToken, signRefreshToken } from './jwt';
import { AuthUser } from '../types';
import { LoginInput } from './auth.validation';
import { writeAuditLog } from '../utils/audit';

export async function login(
  input: LoginInput,
  meta?: { ip?: string; userAgent?: string }
) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const roles = user.userRoles.map((ur) => ur.role.code);
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.code)
      )
    ),
  ];

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles,
    permissions,
  };

  const accessToken = signAccessToken(authUser);
  const refreshToken = signRefreshToken(authUser);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    user: authUser,
    action: 'LOGIN',
    module: 'auth',
    recordId: user.id,
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions,
    },
    accessToken,
    refreshToken,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      member: {
        select: {
          id: true,
          membershipNumber: true,
          status: true,
          category: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!user) throw new Error('NOT_FOUND');

  const roles = user.userRoles.map((ur) => ur.role.code);
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.code)
      )
    ),
  ];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    mobile: user.mobile,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    roles,
    permissions,
    member: user.member,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
