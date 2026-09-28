import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number(), // positive or negative
  notes: z.string().optional(),
});

export async function listInventory(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const warehouseId = query.warehouseId;
  const lowStock = query.lowStock === 'true';
  const where: Record<string, unknown> = {};
  if (warehouseId) where.warehouseId = warehouseId;
  if (lowStock) where.currentQuantity = { lte: prisma.inventory.fields.minimumQuantity };
  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
    }),
    prisma.inventory.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getInventoryByProduct(productId: string) {
  return prisma.inventory.findMany({
    where: { productId },
    include: { warehouse: { select: { id: true, name: true } } },
  });
}

export async function listMovements(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const productId = query.productId;
  const type = query.type as TransactionType | undefined;
  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (type) where.type = type;
  const [data, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, sku: true, name: true } } },
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function createAdjustment(dto: z.infer<typeof adjustmentSchema>, userId: string) {
  const inventory = await prisma.inventory.findUnique({
    where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
  });
  if (!inventory) throw Object.assign(new Error('Inventory record not found for this product/warehouse'), { statusCode: 404 });

  const newQty = Number(inventory.currentQuantity) + dto.quantity;
  if (newQty < 0) throw Object.assign(new Error('Adjustment would result in negative stock'), { statusCode: 400 });

  return prisma.$transaction(async (tx) => {
    await tx.inventory.update({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      data: { currentQuantity: newQty },
    });
    const txRecord = await tx.inventoryTransaction.create({
      data: {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: TransactionType.STOCK_ADJUSTMENT,
        quantity: dto.quantity,
        notes: dto.notes || `Manual adjustment by user ${userId}`,
      },
    });
    return txRecord;
  });
}

export async function getLowStockProducts() {
  return prisma.inventory.findMany({
    where: { currentQuantity: { lte: prisma.inventory.fields.minimumQuantity } },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });
}
