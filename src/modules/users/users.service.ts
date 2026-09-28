import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  roleId: z.string().uuid(),
});

const userSelect = {
  id: true, name: true, email: true, phone: true, isActive: true,
  lastLoginAt: true, createdAt: true,
  role: { select: { id: true, name: true } },
};

export async function listUsers(query: Record<string, string>) {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const search = query.search;
  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ],
  } : {};
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder }, select: userSelect }),
    prisma.user.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
}

export async function createUser(dto: z.infer<typeof createUserSchema>) {
  const exists = await prisma.user.findUnique({ where: { email: dto.email } });
  if (exists) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  const hashedPassword = await bcrypt.hash(dto.password, 12);
  return prisma.user.create({
    data: { ...dto, password: hashedPassword },
    select: userSelect,
  });
}

export async function updateUser(id: string, dto: z.infer<typeof updateUserSchema>) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const data: Record<string, unknown> = { ...dto };
  if (dto.password) {
    data.password = await bcrypt.hash(dto.password, 12);
  }
  return prisma.user.update({ where: { id }, data, select: userSelect });
}

export async function listRoles() {
  return prisma.role.findMany({
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function createRole(dto: { name: string; description?: string; permissionIds?: string[] }) {
  const exists = await prisma.role.findUnique({ where: { name: dto.name } });
  if (exists) throw Object.assign(new Error('Role name already exists'), { statusCode: 409 });
  return prisma.role.create({
    data: {
      name: dto.name,
      description: dto.description,
      rolePermissions: dto.permissionIds?.length ? {
        create: dto.permissionIds.map((pid) => ({ permissionId: pid })),
      } : undefined,
    },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 });
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
  });
  return prisma.role.findUnique({
    where: { id: roleId },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
}
