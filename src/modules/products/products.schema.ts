import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  unitId: z.string().uuid(),
  purchasePrice: z.number().min(0),
  salePrice: z.number().min(0),
  vatRate: z.number().min(0).max(100).default(15),
  isVatExempt: z.boolean().default(false),
  barcode: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
