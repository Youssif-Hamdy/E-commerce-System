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

export async function updateWarehouse(id: string, dto: Partial<z.infer<typeof warehouseSchema>>) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  if (!warehouse.isActive) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  if (dto.name && dto.name !== warehouse.name) {
    const exists = await prisma.warehouse.findUnique({ where: { name: dto.name } });
    if (exists) throw Object.assign(new Error('Warehouse name already exists'), { statusCode: 409 });
  }
  if (dto.isDefault) {
    await prisma.warehouse.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
  }
  return prisma.warehouse.update({ where: { id }, data: dto });
}

export async function deleteWarehouse(id: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: { inventory: { where: { currentQuantity: { gt: 0 } }, take: 1 } },
  });
  if (!warehouse) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  if (!warehouse.isActive) throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  if (warehouse.isDefault) throw Object.assign(new Error('Cannot delete the default warehouse'), { statusCode: 400 });
  if (warehouse.inventory.length > 0)
    throw Object.assign(new Error('Cannot delete warehouse with existing stock. Transfer stock first.'), { statusCode: 400 });
  return prisma.warehouse.update({ where: { id }, data: { isActive: false } });
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
