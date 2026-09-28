import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { round2 } from '../../utils/number';
import { TransactionType } from '@prisma/client';
import type { CreatePurchaseDto } from './purchases.schema';

const purchaseInclude = {
  supplier: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  purchaseItems: {
    include: { product: { select: { id: true, sku: true, name: true } } },
  },
};

export async function listPurchases(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const supplierId = query.supplierId;
  const where: Record<string, unknown> = {};
  if (supplierId) where.supplierId = supplierId;
  const [data, total] = await Promise.all([
    prisma.purchase.findMany({ where, skip, take: limit, orderBy: { purchaseDate: 'desc' }, include: purchaseInclude }),
    prisma.purchase.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getPurchase(id: string) {
  const p = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!p) throw Object.assign(new Error('Purchase not found'), { statusCode: 404 });
  return p;
}

export async function createPurchase(dto: CreatePurchaseDto, userId: string) {
  // Validate all products and get VAT rates
  const products = await Promise.all(dto.items.map((item) =>
    prisma.product.findUnique({ where: { id: item.productId } })
  ));
  for (const p of products) {
    if (!p) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  // Calculate totals
  let subtotal = 0;
  let vatAmount = 0;
  const itemsWithCalc = dto.items.map((item, i) => {
    const product = products[i]!;
    const vatRate = product.isVatExempt ? 0 : Number(product.vatRate);
    const lineSubtotal = round2(item.quantity * item.unitCost);
    const lineVat = round2((lineSubtotal * vatRate) / 100);
    subtotal += lineSubtotal;
    vatAmount += lineVat;
    return { ...item, vatRate, vatAmount: lineVat, total: lineSubtotal + lineVat };
  });
  subtotal = round2(subtotal);
  vatAmount = round2(vatAmount);
  const total = round2(subtotal + vatAmount);

  // Generate purchase number
  const count = await prisma.purchase.count();
  const purchaseNumber = `PO-${String(count + 1).padStart(6, '0')}`;

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: dto.supplierId,
        userId,
        status: 'RECEIVED',
        subtotal,
        vatAmount,
        total,
        notes: dto.notes,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
        purchaseItems: {
          create: itemsWithCalc.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            total: item.total,
          })),
        },
      },
      include: purchaseInclude,
    });

    // Update inventory for each item
    for (const item of itemsWithCalc) {
      // Upsert inventory
      await tx.inventory.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: dto.warehouseId } },
        update: { currentQuantity: { increment: item.quantity } },
        create: {
          productId: item.productId,
          warehouseId: dto.warehouseId,
          currentQuantity: item.quantity,
          minimumQuantity: 0,
        },
      });
      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          warehouseId: dto.warehouseId,
          type: TransactionType.PURCHASE,
          quantity: item.quantity,
          reference: purchase.id,
          notes: `Purchase ${purchaseNumber}`,
        },
      });
    }
    return purchase;
  });
}
