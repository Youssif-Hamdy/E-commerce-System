import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
  })).min(1, 'At least one item required'),
});

export type CreatePurchaseDto = z.infer<typeof createPurchaseSchema>;
