import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { LoginDto, RegisterDto } from './auth.schema';
import type { JwtPayload } from '../../middlewares/auth.middleware';

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function loginService(dto: LoginDto) {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isPasswordValid = await bcrypt.compare(dto.password, user.password);
  if (!isPasswordValid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info(`User ${user.email} logged in`);

  return {
    accessToken,
    refreshToken,
    expiresIn: '30d',
    tokenType: 'Bearer',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
    },
  };
}

export async function registerService(dto: RegisterDto) {
  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existingUser) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
  if (!role) {
    throw Object.assign(new Error('Role not found'), { statusCode: 404 });
  }

  const hashedPassword = await bcrypt.hash(dto.password, 12);

  const user = await prisma.user.create({
    data: {
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      phone: dto.phone,
      roleId: dto.roleId,
    },
    include: { role: true },
  });

  logger.info(`New user registered: ${user.email}`);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
  };
}

export async function refreshTokenService(token: string) {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token revoked or expired'), { statusCode: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });
  }

  // Revoke old token
  await prisma.refreshToken.update({ where: { token }, data: { isRevoked: true } });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { token: newRefreshToken, userId: user.id, expiresAt },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: '30d',
    tokenType: 'Bearer',
  };
}

export async function logoutService(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { isRevoked: true },
  });
  logger.info(`Token revoked`);
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });

  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.name,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.name),
    lastLoginAt: user.lastLoginAt,
  };
}
