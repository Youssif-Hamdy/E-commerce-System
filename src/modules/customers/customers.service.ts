import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('SA'),
  isWalkIn: z.boolean().default(false),
});

export async function listCustomers(query: Record<string, string>) {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const search = query.search;
  const where = search ? { OR: [
    { name: { contains: search, mode: 'insensitive' as const } },
    { phone: { contains: search } },
    { email: { contains: search, mode: 'insensitive' as const } },
    { vatNumber: { contains: search } },
  ]} : {};
  const [data, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.customer.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getCustomer(id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  return c;
}

export async function createCustomer(dto: z.infer<typeof customerSchema>) {
  return prisma.customer.create({ data: dto });
}

export async function updateCustomer(id: string, dto: Partial<z.infer<typeof customerSchema>>) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  return prisma.customer.update({ where: { id }, data: dto });
}

export async function getOrCreateWalkIn(): Promise<string> {
  let walkIn = await prisma.customer.findFirst({ where: { isWalkIn: true } });
  if (!walkIn) {
    walkIn = await prisma.customer.create({
      data: { name: 'Walk-in Customer', isWalkIn: true, country: 'SA' },
    });
  }
  return walkIn.id;
}
