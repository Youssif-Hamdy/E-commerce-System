import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const transferSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be a positive number'),
  notes: z.string().optional(),
});

export async function transferStock(dto: z.infer<typeof transferSchema>, userId: string) {
  if (dto.fromWarehouseId === dto.toWarehouseId)
    throw Object.assign(new Error('Source and destination warehouses must be different'), { statusCode: 400 });

  // Validate warehouses exist
  const [fromWh, toWh] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: dto.fromWarehouseId, isActive: true } }),
    prisma.warehouse.findUnique({ where: { id: dto.toWarehouseId, isActive: true } }),
  ]);
  if (!fromWh) throw Object.assign(new Error('Source warehouse not found'), { statusCode: 404 });
  if (!toWh) throw Object.assign(new Error('Destination warehouse not found'), { statusCode: 404 });

  // Validate product exists
  const product = await prisma.product.findUnique({ where: { id: dto.productId, isActive: true } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });

  return prisma.$transaction(async (tx) => {
    // Check source inventory
    const sourceInv = await tx.inventory.findUnique({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.fromWarehouseId } },
    });
    if (!sourceInv) throw Object.assign(new Error('Product not found in source warehouse'), { statusCode: 404 });

    const currentQty = Number(sourceInv.currentQuantity);
    if (currentQty < dto.quantity)
      throw Object.assign(
        new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${dto.quantity}`),
        { statusCode: 400 }
      );

    // Deduct from source
    await tx.inventory.update({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.fromWarehouseId } },
      data: { currentQuantity: currentQty - dto.quantity },
    });

    // Add to destination (upsert in case inventory record doesn't exist yet)
    await tx.inventory.upsert({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.toWarehouseId } },
      update: { currentQuantity: { increment: dto.quantity } },
      create: {
        productId: dto.productId,
        warehouseId: dto.toWarehouseId,
        currentQuantity: dto.quantity,
        minimumQuantity: 0,
      },
    });

    const transferRef = `TRF-${Date.now()}`;
    const notesText = dto.notes || `Stock transfer by user ${userId}: ${fromWh.name} → ${toWh.name}`;

    // Record TRANSFER_OUT
    const outTx = await tx.inventoryTransaction.create({
      data: {
        productId: dto.productId,
        warehouseId: dto.fromWarehouseId,
        type: TransactionType.TRANSFER_OUT,
        quantity: -dto.quantity,
        reference: transferRef,
        notes: notesText,
      },
    });

    // Record TRANSFER_IN
    await tx.inventoryTransaction.create({
      data: {
        productId: dto.productId,
        warehouseId: dto.toWarehouseId,
        type: TransactionType.TRANSFER_IN,
        quantity: dto.quantity,
        reference: transferRef,
        notes: notesText,
      },
    });

    return {
      reference: transferRef,
      productId: dto.productId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      quantity: dto.quantity,
      transactionId: outTx.id,
    };
  });
}


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
