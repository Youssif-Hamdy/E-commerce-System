import { prisma } from '../../config/database';
import { z } from 'zod';

export const warehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function listWarehouses() {
  return prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

export async function createWarehouse(dto: z.infer<typeof warehouseSchema>) {
  const exists = await prisma.warehouse.findUnique({ where: { name: dto.name } });
  if (exists) throw Object.assign(new Error('Warehouse name already exists'), { statusCode: 409 });
  if (dto.isDefault) {
    await prisma.warehouse.updateMany({ data: { isDefault: false } });
  }
  return prisma.warehouse.create({ data: dto });
}

export async function getDefaultWarehouseId(): Promise<string> {
  const w = await prisma.warehouse.findFirst({ where: { isDefault: true, isActive: true } });
  if (!w) {
    // Auto-create default warehouse if none exists
    const created = await prisma.warehouse.create({
      data: { name: 'Main Warehouse', isDefault: true },
    });
    return created.id;
  }
  return w.id;
}
