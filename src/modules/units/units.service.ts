import { prisma } from '../../config/database';
import { z } from 'zod';

export const unitSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1).max(10),
  isActive: z.boolean().optional(),
});

export async function listUnits() {
  return prisma.unit.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

export async function createUnit(dto: z.infer<typeof unitSchema>) {
  const exists = await prisma.unit.findUnique({ where: { name: dto.name } });
  if (exists) throw Object.assign(new Error('Unit name already exists'), { statusCode: 409 });
  return prisma.unit.create({ data: dto });
}

export async function updateUnit(id: string, dto: Partial<z.infer<typeof unitSchema>>) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) throw Object.assign(new Error('Unit not found'), { statusCode: 404 });
  return prisma.unit.update({ where: { id }, data: dto });
}
