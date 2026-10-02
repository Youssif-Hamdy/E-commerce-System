import { z } from 'zod';

export const createUnitSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'اسم الوحدة مطلوب' }).min(3, 'اسم الوحدة يجب أن يكون 3 أحرف على الأقل'),
    environment: z.enum(['sandbox', 'simulation', 'production'], { 
      required_error: 'البيئة مطلوبة',
      invalid_type_error: 'البيئة يجب أن تكون sandbox أو simulation أو production'
    }),
  })
});

export const otpSchema = z.object({
  body: z.object({
    // Allow any placeholder for Sandbox (min length 1 instead of 6)
    otp: z.string({ required_error: 'رمز التحقق (OTP) مطلوب' }).min(1, 'رمز التحقق مطلوب')
  })
});

export const generateCsrSchema = z.object({
  params: z.object({
    id: z.string().uuid('معرف الوحدة غير صحيح')
  }),
  body: z.object({
    vatNumber: z.string().regex(/^3\d{13}3$/, 'الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3').optional(),
    invoiceType: z.string().regex(/^[01]{4}$/, 'نوع الفاتورة يجب أن يكون 4 أرقام من 0 و 1').refine(v => v !== '0000', 'لا يمكن أن يكون نوع الفاتورة 0000').optional(),
    branchName: z.string().optional(),
    organizationName: z.string().optional(),
    commonName: z.string().optional(),
    serialNumber: z.string().optional(),
    address: z.string().optional(),
    industry: z.string().optional(),
  }).optional()
});

export const unitIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('معرف الوحدة غير صحيح')
  })
});
