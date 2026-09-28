import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function listCategories(query: Record<string, string>) {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const search = query.search;
  const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
  const [data, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.category.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function createCategory(dto: z.infer<typeof categorySchema>) {
  const exists = await prisma.category.findUnique({ where: { name: dto.name } });
  if (exists) throw Object.assign(new Error('Category name already exists'), { statusCode: 409 });
  return prisma.category.create({ data: dto });
}

export async function updateCategory(id: string, dto: Partial<z.infer<typeof categorySchema>>) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  return prisma.category.update({ where: { id }, data: dto });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id }, include: { products: { take: 1 } } });
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  if (category.products.length > 0) throw Object.assign(new Error('Cannot delete category with products'), { statusCode: 400 });
  return prisma.category.delete({ where: { id } });
}
