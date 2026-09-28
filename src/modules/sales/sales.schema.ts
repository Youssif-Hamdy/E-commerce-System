import { z } from 'zod';

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0).optional(), // If not provided, uses product's salePrice
        discount: z.number().min(0).default(0),
      })
    )
    .min(1, 'At least one item required'),
});

export type CreateSaleDto = z.infer<typeof createSaleSchema>;
