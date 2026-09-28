import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { round2 } from '../../utils/number';
import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const returnSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1),
});

export type CreateReturnDto = z.infer<typeof returnSchema>;

export async function listReturns(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const [data, total] = await Promise.all([
    prisma.return.findMany({
      skip, take: limit, orderBy: { returnDate: 'desc' },
      include: {
        sale: { select: { id: true, saleNumber: true } },
        customer: { select: { id: true, name: true } },
        returnItems: true,
        creditNote: { select: { id: true, noteNumber: true, status: true } },
      },
    }),
    prisma.return.count(),
  ]);
  return { data, total, page, limit };
}

export async function getReturn(id: string) {
  const r = await prisma.return.findUnique({
    where: { id },
    include: {
      sale: { select: { id: true, saleNumber: true } },
      customer: { select: { id: true, name: true } },
      returnItems: true,
      creditNote: { select: { id: true, noteNumber: true, status: true } },
    },
  });
  if (!r) throw Object.assign(new Error('Return not found'), { statusCode: 404 });
  return r;
}

export async function createReturn(dto: CreateReturnDto) {
  const sale = await prisma.sale.findUnique({
    where: { id: dto.saleId },
    include: { saleItems: { include: { product: true } } },
  });
  if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
  if (sale.status === 'CANCELLED') throw Object.assign(new Error('Cannot return a cancelled sale'), { statusCode: 400 });

  for (const item of dto.items) {
    const saleItem = sale.saleItems.find((si) => si.productId === item.productId);
    if (!saleItem) throw Object.assign(new Error(`Product ${item.productId} not in original sale`), { statusCode: 400 });
    if (item.quantity > Number(saleItem.quantity)) {
      throw Object.assign(new Error(`Cannot return more than sold qty for ${saleItem.product.name}`), { statusCode: 400 });
    }
  }

  let subtotal = 0;
  let vatAmount = 0;
  const itemsWithCalc = dto.items.map((item) => {
    const saleItem = sale.saleItems.find((si) => si.productId === item.productId)!;
    const unitPrice = Number(saleItem.unitPrice);
    const vatRate = Number(saleItem.vatRate);
    const lineSubtotal = round2(item.quantity * unitPrice);
    const lineVat = round2((lineSubtotal * vatRate) / 100);
    subtotal += lineSubtotal;
    vatAmount += lineVat;
    return { ...item, unitPrice, vatRate, vatAmount: lineVat, total: lineSubtotal + lineVat };
  });

  subtotal = round2(subtotal);
  vatAmount = round2(vatAmount);
  const total = round2(subtotal + vatAmount);

  const count = await prisma.return.count();
  const returnNumber = `RTN-${String(count + 1).padStart(6, '0')}`;

  return prisma.$transaction(async (tx) => {
    const ret = await tx.return.create({
      data: {
        returnNumber,
        saleId: dto.saleId,
        customerId: sale.customerId,
        status: 'COMPLETED',
        reason: dto.reason,
        subtotal,
        vatAmount,
        total,
        returnItems: {
          create: itemsWithCalc.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            total: item.total,
          })),
        },
      },
    });

    for (const item of itemsWithCalc) {
      const inventory = await tx.inventory.findFirst({ where: { productId: item.productId } });
      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { currentQuantity: { increment: item.quantity } },
        });
      }
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: TransactionType.RETURN_IN,
          quantity: item.quantity,
          reference: ret.id,
          notes: `Return ${returnNumber}`,
        },
      });
    }

    const noteCount = await tx.creditNote.count();
    await tx.creditNote.create({
      data: {
        noteNumber: `CN-${String(noteCount + 1).padStart(6, '0')}`,
        returnId: ret.id,
        status: 'DRAFT',
        subtotal,
        vatAmount,
        total,
      },
    });

    await tx.sale.update({ where: { id: dto.saleId }, data: { status: 'REFUNDED' } });

    return tx.return.findUnique({
      where: { id: ret.id },
      include: {
        sale: { select: { id: true, saleNumber: true } },
        customer: { select: { id: true, name: true } },
        returnItems: true,
        creditNote: { select: { id: true, noteNumber: true, status: true } },
      },
    });
  });
}
