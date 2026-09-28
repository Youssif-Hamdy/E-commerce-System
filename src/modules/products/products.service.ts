import { prisma } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import type { CreateProductDto, UpdateProductDto } from './products.schema';

const productInclude = {
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
  inventory: { select: { currentQuantity: true, minimumQuantity: true } },
};

export async function listProducts(query: Record<string, string>) {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const search = query.search;
  const categoryId = query.categoryId;
  const where: Record<string, unknown> = {};
  if (search) where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { sku: { contains: search, mode: 'insensitive' } },
    { barcode: { contains: search, mode: 'insensitive' } },
  ];
  if (categoryId) where.categoryId = categoryId;
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder }, include: productInclude }),
    prisma.product.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  return product;
}

export async function getProductBySku(sku: string) {
  const product = await prisma.product.findUnique({ where: { sku }, include: productInclude });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  return product;
}

export async function createProduct(dto: CreateProductDto) {
  const exists = await prisma.product.findUnique({ where: { sku: dto.sku } });
  if (exists) throw Object.assign(new Error('SKU already exists'), { statusCode: 409 });
  const catExists = await prisma.category.findUnique({ where: { id: dto.categoryId } });
  if (!catExists) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  const unitExists = await prisma.unit.findUnique({ where: { id: dto.unitId } });
  if (!unitExists) throw Object.assign(new Error('Unit not found'), { statusCode: 404 });
  return prisma.product.create({
    data: {
      ...dto,
      purchasePrice: dto.purchasePrice,
      salePrice: dto.salePrice,
      vatRate: dto.vatRate,
    },
    include: productInclude,
  });
}

export async function updateProduct(id: string, dto: UpdateProductDto) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  if (dto.sku && dto.sku !== product.sku) {
    const exists = await prisma.product.findUnique({ where: { sku: dto.sku } });
    if (exists) throw Object.assign(new Error('SKU already exists'), { statusCode: 409 });
  }
  return prisma.product.update({ where: { id }, data: dto, include: productInclude });
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}
