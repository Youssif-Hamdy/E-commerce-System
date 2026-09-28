import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { successResponse } from '../../utils/response';

function dateRange(query: Record<string, string>) {
  const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  return { gte: from, lte: to };
}

/**
 * @swagger
 * /reports/sales:
 *   get:
 *     tags: [Reports]
 *     summary: Sales report
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: "2024-01-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: "2024-12-31" }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, month, product, user, customer] }
 *     responses:
 *       200:
 *         description: Sales report data
 */
export async function salesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const range = dateRange(q);

    const [totals, byProduct, topCustomers, dailySales] = await Promise.all([
      // Overall totals
      prisma.sale.aggregate({
        where: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
        _sum: { subtotal: true, vatAmount: true, total: true, discountAmount: true },
        _count: { id: true },
      }),
      // Top products
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } } },
        _sum: { quantity: true, total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      // Top customers
      prisma.sale.groupBy({
        by: ['customerId'],
        where: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] }, customerId: { not: null } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      // Daily sales for chart
      prisma.sale.findMany({
        where: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
        select: { saleDate: true, total: true, vatAmount: true },
        orderBy: { saleDate: 'asc' },
      }),
    ]);

    successResponse(res, { totals, byProduct, topCustomers, dailySales });
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /reports/inventory:
 *   get:
 *     tags: [Reports]
 *     summary: Inventory report
 *     responses:
 *       200:
 *         description: Current stock levels and movement summary
 */
export async function inventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [stockLevels, lowStock, movements] = await Promise.all([
      prisma.inventory.findMany({
        include: {
          product: { select: { id: true, sku: true, name: true, salePrice: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { currentQuantity: 'asc' },
      }),
      prisma.inventory.findMany({
        where: { currentQuantity: { lte: 5 } },
        include: { product: { select: { id: true, sku: true, name: true } } },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['type'],
        _sum: { quantity: true },
        _count: { id: true },
      }),
    ]);

    successResponse(res, {
      stockLevels,
      lowStockItems: lowStock,
      movementSummary: movements,
      totalProducts: stockLevels.length,
      totalLowStock: lowStock.length,
    });
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /reports/purchases:
 *   get:
 *     tags: [Reports]
 *     summary: Purchases report
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Purchase report data
 */
export async function purchasesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const range = dateRange(q);

    const [totals, bySupplier] = await Promise.all([
      prisma.purchase.aggregate({
        where: { purchaseDate: range },
        _sum: { subtotal: true, vatAmount: true, total: true },
        _count: { id: true },
      }),
      prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { purchaseDate: range },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
    ]);

    successResponse(res, { totals, bySupplier });
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /reports/profit:
 *   get:
 *     tags: [Reports]
 *     summary: Profit & VAT report
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Revenue, cost, profit, and VAT summary
 */
export async function profitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const range = dateRange(q);

    const [revenue, costs, vatCollected, vatPaid] = await Promise.all([
      prisma.sale.aggregate({
        where: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
        _sum: { subtotal: true, vatAmount: true, total: true },
      }),
      prisma.purchase.aggregate({
        where: { purchaseDate: range },
        _sum: { subtotal: true, vatAmount: true, total: true },
      }),
      prisma.sale.aggregate({
        where: { saleDate: range, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
        _sum: { vatAmount: true },
      }),
      prisma.purchase.aggregate({
        where: { purchaseDate: range },
        _sum: { vatAmount: true },
      }),
    ]);

    const grossRevenue = Number(revenue._sum.subtotal || 0);
    const totalCost = Number(costs._sum.subtotal || 0);
    const grossProfit = grossRevenue - totalCost;
    const vatCollectedAmt = Number(vatCollected._sum.vatAmount || 0);
    const vatPaidAmt = Number(vatPaid._sum.vatAmount || 0);
    const vatPayable = vatCollectedAmt - vatPaidAmt;

    successResponse(res, {
      revenue: {
        gross: grossRevenue,
        vat: Number(revenue._sum.vatAmount || 0),
        total: Number(revenue._sum.total || 0),
      },
      costs: {
        gross: totalCost,
        vat: Number(costs._sum.vatAmount || 0),
        total: Number(costs._sum.total || 0),
      },
      profit: {
        gross: grossProfit,
        margin: grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 100 * 100) / 100 : 0,
      },
      vat: {
        collected: vatCollectedAmt,
        paid: vatPaidAmt,
        payable: vatPayable,
      },
    });
  } catch (e) { next(e); }
}
