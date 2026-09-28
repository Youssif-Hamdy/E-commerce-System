import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const startStockCountSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  notes: z.string().optional(),
  productIds: z.array(z.string().uuid()).optional(), // empty = count all
});

export const submitCountSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    actualQuantity: z.number().min(0),
    notes: z.string().optional(),
  })),
});

export async function listStockCounts(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const [data, total] = await Promise.all([
    prisma.stockCount.findMany({
      skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } }, _count: { select: { stockCountItems: true } } },
    }),
    prisma.stockCount.count(),
  ]);
  return { data, total, page, limit };
}

export async function getStockCount(id: string) {
  const sc = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      stockCountItems: {
        include: { product: { select: { id: true, sku: true, name: true } } },
      },
    },
  });
  if (!sc) throw Object.assign(new Error('Stock count not found'), { statusCode: 404 });
  return sc;
}

export async function startStockCount(dto: z.infer<typeof startStockCountSchema>, userId: string) {
  const count = await prisma.stockCount.count();
  const reference = `SC-${String(count + 1).padStart(6, '0')}`;

  // Get products to count
  const where = dto.productIds?.length
    ? { id: { in: dto.productIds }, isActive: true }
    : { isActive: true };

  const products = await prisma.product.findMany({
    where,
    include: {
      inventory: dto.warehouseId
        ? { where: { warehouseId: dto.warehouseId } }
        : true,
    },
  });

  return prisma.stockCount.create({
    data: {
      reference,
      warehouseId: dto.warehouseId,
      status: 'IN_PROGRESS',
      notes: dto.notes,
      userId,
      startedAt: new Date(),
      stockCountItems: {
        create: products.map((p) => ({
          productId: p.id,
          systemQuantity: p.inventory[0]
            ? Number(p.inventory[0].currentQuantity)
            : 0,
        })),
      },
    },
    include: {
      stockCountItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
  });
}

export async function submitCountItems(id: string, dto: z.infer<typeof submitCountSchema>) {
  const sc = await prisma.stockCount.findUnique({ where: { id } });
  if (!sc) throw Object.assign(new Error('Stock count not found'), { statusCode: 404 });
  if (sc.status === 'APPROVED') throw Object.assign(new Error('Stock count already approved'), { statusCode: 400 });

  const updates = dto.items.map((item) =>
    prisma.stockCountItem.updateMany({
      where: { stockCountId: id, productId: item.productId },
      data: {
        actualQuantity: item.actualQuantity,
        difference: item.actualQuantity, // will recalculate below
        notes: item.notes,
      },
    })
  );
  await Promise.all(updates);

  // Recalculate differences
  const items = await prisma.stockCountItem.findMany({ where: { stockCountId: id } });
  for (const item of items) {
    if (item.actualQuantity !== null) {
      await prisma.stockCountItem.update({
        where: { id: item.id },
        data: { difference: Number(item.actualQuantity) - Number(item.systemQuantity) },
      });
    }
  }

  return prisma.stockCount.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: { stockCountItems: { include: { product: { select: { id: true, sku: true, name: true } } } } },
  });
}

export async function approveStockCount(id: string) {
  const sc = await prisma.stockCount.findUnique({
    where: { id },
    include: { stockCountItems: true },
  });
  if (!sc) throw Object.assign(new Error('Stock count not found'), { statusCode: 404 });
  if (sc.status !== 'COMPLETED') throw Object.assign(new Error('Stock count must be completed before approval'), { statusCode: 400 });

  return prisma.$transaction(async (tx) => {
    // Apply adjustments for items with differences
    const itemsWithDiff = sc.stockCountItems.filter(
      (i) => i.actualQuantity !== null && i.difference !== null && Number(i.difference) !== 0
    );

    for (const item of itemsWithDiff) {
      const inventory = await tx.inventory.findFirst({ where: { productId: item.productId } });
      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { currentQuantity: Number(item.actualQuantity) },
        });
      }
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          warehouseId: sc.warehouseId,
          type: TransactionType.STOCK_ADJUSTMENT,
          quantity: Number(item.difference),
          reference: sc.id,
          notes: `Stock count ${sc.reference} adjustment`,
        },
      });
    }

    return tx.stockCount.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
  });
}
