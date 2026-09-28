import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('SA'),
});

export async function listSuppliers(query: Record<string, string>) {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const search = query.search;
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { vatNumber: { contains: search } },
        ],
      }
    : {};
  const [data, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.supplier.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getSupplier(id: string) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
  return s;
}

export async function createSupplier(dto: z.infer<typeof supplierSchema>) {
  return prisma.supplier.create({ data: dto });
}

export async function updateSupplier(id: string, dto: Partial<z.infer<typeof supplierSchema>>) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) throw Object.assign(new Error('Supplier not found'), { statusCode: 404 });
  return prisma.supplier.update({ where: { id }, data: dto });
}
