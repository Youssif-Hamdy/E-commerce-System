import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { round2 } from '../../utils/number';
import { TransactionType } from '@prisma/client';
import { getDefaultWarehouseId } from '../warehouses/warehouses.service';
import { createInvoiceForSale } from '../invoices/invoices.service';
import type { CreateSaleDto } from './sales.schema';

const saleInclude = {
  customer: { select: { id: true, name: true, vatNumber: true } },
  user: { select: { id: true, name: true } },
  saleItems: {
    include: { product: { select: { id: true, sku: true, name: true } } },
  },
  payments: true,
  invoice: { select: { id: true, invoiceNumber: true, status: true, qrCode: true } },
};

export async function listSales(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const customerId = query.customerId;
  const userId = query.userId;
  const status = query.status;
  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = customerId;
  if (userId) where.userId = userId;
  if (status) where.status = status;
  const [data, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { saleDate: 'desc' },
      include: saleInclude,
    }),
    prisma.sale.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getSale(id: string) {
  const sale = await prisma.sale.findUnique({ where: { id }, include: saleInclude });
  if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
  return sale;
}

export async function createSale(dto: CreateSaleDto, userId: string) {
  const warehouseId = dto.warehouseId || (await getDefaultWarehouseId());

  // ── Step 1: Load all products and validate stock ──────────────────────────
  const productIds = dto.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      inventory: {
        where: { warehouseId },
      },
    },
  });

  // Check all products exist
  for (const item of dto.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw Object.assign(new Error(`Product ${item.productId} not found`), { statusCode: 404 });
    }
    if (!product.isActive) {
      throw Object.assign(new Error(`Product "${product.name}" is inactive`), { statusCode: 400 });
    }

    // Check stock availability
    const inventory = product.inventory[0];
    const available = inventory ? Number(inventory.currentQuantity) : 0;
    if (available < item.quantity) {
      throw Object.assign(
        new Error(
          `Insufficient stock for "${product.name}". Available: ${available}, Requested: ${item.quantity}`
        ),
        { statusCode: 400 }
      );
    }
  }

  // ── Step 2: Calculate totals ──────────────────────────────────────────────
  let subtotal = 0;
  let totalVat = 0;

  const itemsWithCalc = dto.items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const unitPrice = item.unitPrice ?? Number(product.salePrice);
    const vatRate = product.isVatExempt ? 0 : Number(product.vatRate);
    const lineSubtotal = round2(item.quantity * unitPrice - (item.discount || 0));
    const lineVat = round2((lineSubtotal * vatRate) / 100);
    subtotal += lineSubtotal;
    totalVat += lineVat;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      discount: item.discount || 0,
      vatRate,
      vatAmount: lineVat,
      total: round2(lineSubtotal + lineVat),
      product,
    };
  });

  subtotal = round2(subtotal - (dto.discountAmount || 0));
  totalVat = round2(totalVat);
  const total = round2(subtotal + totalVat);

  // ── Step 3: Generate sale number ──────────────────────────────────────────
  const count = await prisma.sale.count();
  const saleNumber = `INV-${String(count + 1).padStart(6, '0')}`;

  // ── Step 4: Database transaction ──────────────────────────────────────────
  const sale = await prisma.$transaction(async (tx) => {
    // Create sale
    const newSale = await tx.sale.create({
      data: {
        saleNumber,
        customerId: dto.customerId,
        userId,
        status: 'COMPLETED',
        subtotal,
        discountAmount: dto.discountAmount || 0,
        vatAmount: totalVat,
        total,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        saleItems: {
          create: itemsWithCalc.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            total: item.total,
          })),
        },
      },
      include: saleInclude,
    });

    // Create payment record
    await tx.payment.create({
      data: {
        saleId: newSale.id,
        amount: total,
        method: dto.paymentMethod,
      },
    });

    // Decrease inventory + create transactions
    for (const item of itemsWithCalc) {
      await tx.inventory.update({
        where: { productId_warehouseId: { productId: item.productId, warehouseId } },
        data: { currentQuantity: { decrement: item.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          warehouseId,
          type: TransactionType.SALE,
          quantity: -item.quantity,
          reference: newSale.id,
          notes: `Sale ${saleNumber}`,
        },
      });
    }

    return newSale;
  });

  // ── Step 5: Create ZATCA Invoice ──────────────────────────────────────────
  try {
    await createInvoiceForSale(sale.id);
  } catch (invoiceError) {
    // Invoice creation failure should not block sale
    console.error('Invoice creation error (non-blocking):', invoiceError);
  }

  return prisma.sale.findUnique({ where: { id: sale.id }, include: saleInclude });
}

export async function cancelSale(id: string) {
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
  if (sale.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending sales can be cancelled'), { statusCode: 400 });
  }
  return prisma.sale.update({ where: { id }, data: { status: 'CANCELLED' } });
}
