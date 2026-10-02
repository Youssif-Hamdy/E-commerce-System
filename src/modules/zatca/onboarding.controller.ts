import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { successResponse } from '../../utils/response';
import * as onboardingService from './onboarding.service';

/**
 * @swagger
 * tags:
 *   name: ZATCA
 *   description: ZATCA Integration — هيئة الزكاة والضريبة والجمارك
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ZatcaUnitStatus:
 *       type: string
 *       enum: [NOT_CONNECTED, COMPLIANCE, CONNECTED, EXPIRED, FAILED]
 *       description: |
 *         - `NOT_CONNECTED`: الحالة الافتراضية عند الإنشاء
 *         - `COMPLIANCE`: تم الحصول على Compliance CSID
 *         - `CONNECTED`: جاهز للإنتاج، Production CSID مُفعَّل ✅
 *         - `EXPIRED`: انتهت صلاحية الشهادة
 *         - `FAILED`: فشل في إحدى مراحل الـ Onboarding
 *
 *     ZatcaUnit:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         name:
 *           type: string
 *           example: "الفرع الرئيسي - الرياض"
 *         environment:
 *           type: string
 *           enum: [sandbox, simulation, production]
 *           example: "sandbox"
 *         status:
 *           $ref: '#/components/schemas/ZatcaUnitStatus'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ZatcaUnitStatusDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         environment:
 *           type: string
 *           enum: [sandbox, simulation, production]
 *         status:
 *           $ref: '#/components/schemas/ZatcaUnitStatus'
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: تاريخ انتهاء صلاحية شهادة الإنتاج
 *         lastError:
 *           type: object
 *           nullable: true
 *           properties:
 *             errorMessage:
 *               type: string
 *             createdAt:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /zatca/units:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[STEP 1] إنشاء وحدة ZATCA جديدة"
 *     description: |
 *       الخطوة الأولى في عملية الـ Onboarding.
 *       تُنشئ وحدة جديدة بحالة `NOT_CONNECTED`.
 *
 *       **ترتيب الـ Onboarding الكامل:**
 *       1. ✅ POST /zatca/units — إنشاء وحدة
 *       2. POST /zatca/units/:id/csr — توليد المفاتيح
 *       3. POST /zatca/units/:id/compliance — شهادة الامتثال
 *       4. POST /zatca/units/:id/compliance-check — اختبارات الامتثال
 *       5. POST /zatca/units/:id/production — شهادة الإنتاج
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, environment]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 example: "الفرع الرئيسي - الرياض"
 *               environment:
 *                 type: string
 *                 enum: [sandbox, simulation, production]
 *                 example: "sandbox"
 *                 description: |
 *                   - `sandbox`: بيئة اختبار ZATCA الرسمية
 *                   - `simulation`: محاكاة (تحتاج منشأة حقيقية — قيد الإعداد)
 *                   - `production`: الإنتاج الفعلي
 *     responses:
 *       201:
 *         description: تم إنشاء الوحدة بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "تم إنشاء الوحدة بنجاح"
 *                 data:
 *                   $ref: '#/components/schemas/ZatcaUnit'
 *       400:
 *         description: بيانات غير صحيحة
 *       401:
 *         description: غير مصرح — الـ Token مفقود أو منتهي
 *       403:
 *         description: لا تملك صلاحية zatca:onboard
 */
export async function createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, environment } = req.body;
    const unit = await prisma.zatcaUnit.create({
      data: { name, environment }
    });
    
    // Log Audit
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        module: 'zatca_units',
        entityId: unit.id,
        newValues: { name, environment },
        userId: (req as any).user?.id || null, // Assuming auth middleware sets req.user
      }
    });

    successResponse(res, unit, 'تم إنشاء الوحدة بنجاح', 201);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /zatca/units/{id}/csr:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[STEP 2] توليد مفاتيح التشفير وطلب الشهادة (CSR)"
 *     description: |
 *       الخطوة الثانية — تُولّد زوج مفاتيح وتُهيئ حالة SDK.
 *
 *       - يُخزَّن المفتاح الخاص مُشفَّراً في قاعدة البيانات
 *       - لا تتغير حالة الوحدة بعد هذه الخطوة
 *       - جميع الحقول اختيارية، تُستخدم القيم الافتراضية للـ Sandbox
 *
 *       **invoiceType (حسب دليل ZATCA الرسمي):**
 *       - `1000` = Standard فقط (B2B)
 *       - `0100` = Simplified فقط (B2C)
 *       - `1100` = الاثنتان معاً ✅ (الأكثر شيوعاً)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: معرّف الوحدة (من STEP 1)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vatNumber:
 *                 type: string
 *                 example: "399999999900003"
 *                 description: الرقم الضريبي — 15 رقم يبدأ وينتهي بـ 3
 *               invoiceType:
 *                 type: string
 *                 enum: ["1000", "0100", "1100"]
 *                 example: "1100"
 *               branchName:
 *                 type: string
 *                 example: "الفرع الرئيسي"
 *               organizationName:
 *                 type: string
 *                 example: "Maximum Speed Tech Supply LTD"
 *               commonName:
 *                 type: string
 *                 example: "TST-886431145-399999999900003"
 *               address:
 *                 type: string
 *                 example: "RRRD2929"
 *                 description: رمز الموقع الجغرافي
 *               industry:
 *                 type: string
 *                 example: "Supply activities"
 *     responses:
 *       200:
 *         description: تم توليد المفاتيح وتهيئة SDK بنجاح
 *       404:
 *         description: الوحدة غير موجودة
 *       500:
 *         description: خطأ في توليد المفاتيح
 */
export async function generateCsr(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await onboardingService.generateCsr(id, req.body);
    
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_csr', status: 'success' }
    });

    successResponse(res, result, 'تم توليد مفاتيح التشفير وطلب الشهادة (CSR) بنجاح');
  } catch (e) {
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_csr', status: 'error', errorMessage: (e as Error).message }
    });
    next(e);
  }
}

/**
 * @swagger
 * /zatca/units/{id}/compliance:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[STEP 3] طلب شهادة الامتثال (Compliance CSID)"
 *     description: |
 *       الخطوة الثالثة — تُرسل الـ CSR لـ ZATCA وتستلم Compliance CSID.
 *
 *       **بعد النجاح:** حالة الوحدة → `COMPLIANCE`
 *
 *       **⚠️ يجب تشغيل STEP 2 أولاً، وإلا سيُرجع خطأ "SDK state not found".**
 *
 *       **OTP حسب البيئة:**
 *       | البيئة | OTP المطلوب |
 *       |--------|------------|
 *       | mock (ZATCA_ENV=mock) | أي رقم |
 *       | sandbox | `123345` (من Swagger ZATCA الرسمي) |
 *       | simulation / production | OTP حقيقي من fatoora.zatca.gov.sa |
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 minLength: 1
 *                 example: "123345"
 *     responses:
 *       200:
 *         description: تم الحصول على شهادة الامتثال
 *       400:
 *         description: OTP مفقود أو SDK state غير موجود
 *       404:
 *         description: الوحدة غير موجودة
 *       500:
 *         description: خطأ من ZATCA API
 */
export async function requestCompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    
    const result = await onboardingService.requestComplianceCsid(id, otp);
    
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_compliance', status: 'success' }
    });

    successResponse(res, result, 'تم الحصول على شهادة الامتثال بنجاح');
  } catch (e) {
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_compliance', status: 'error', errorMessage: (e as Error).message }
    });
    next(e);
  }
}

/**
 * @swagger
 * /zatca/units/{id}/compliance-check:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[STEP 4] تشغيل اختبارات الامتثال"
 *     description: |
 *       الخطوة الرابعة — تُرسل فواتير تجريبية متعددة لـ ZATCA للتحقق من الإعداد.
 *       (STANDARD، SIMPLIFIED، CREDIT NOTE، DEBIT NOTE)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: اكتملت الاختبارات
 *       404:
 *         description: الوحدة غير موجودة أو SDK state غير مُهيَّأ
 */
export async function runComplianceCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await onboardingService.runComplianceChecks(id);
    
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_compliance_check', status: 'success' } // Omit response body to avoid secrets
    });

    successResponse(res, result, 'تم إنهاء اختبارات الامتثال بنجاح');
  } catch (e) {
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_compliance_check', status: 'error', errorMessage: (e as Error).message }
    });
    next(e);
  }
}

/**
 * @swagger
 * /zatca/units/{id}/production:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[STEP 5] طلب شهادة الإنتاج (Production CSID) ✅"
 *     description: |
 *       الخطوة الأخيرة — تُحوّل Compliance CSID إلى Production CSID.
 *       **بعد النجاح:** حالة الوحدة → `CONNECTED` ✅
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: تم الحصول على Production CSID
 *       400:
 *         description: Compliance CSID غير موجود
 *       404:
 *         description: الوحدة غير موجودة
 *       500:
 *         description: خطأ من ZATCA API
 */
export async function requestProduction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await onboardingService.requestProductionCsid(id);
    
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_production', status: 'success' }
    });

    successResponse(res, result, 'تم الربط الفعلي والحصول على شهادة الإنتاج بنجاح');
  } catch (e) {
    await prisma.zatcaLog.create({
      data: { action: 'onboarding_production', status: 'error', errorMessage: (e as Error).message }
    });
    next(e);
  }
}

/**
 * @swagger
 * /zatca/units/{id}/renew:
 *   post:
 *     tags: [ZATCA]
 *     summary: "[MAINTENANCE] تجديد شهادة ZATCA"
 *     description: |
 *       تجديد Production CSID عند انتهاء صلاحية الشهادة (حالة `EXPIRED`).
 *       **⚠️ غير مُنفَّذة بعد** — ستُرجع خطأ 500 حالياً.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "OTP_FROM_ZATCA_PORTAL"
 *     responses:
 *       200:
 *         description: تم تجديد الشهادة بنجاح
 *       500:
 *         description: غير مُنفَّذة بعد
 */
export async function renewCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const result = await onboardingService.renewCertificate(id, otp);
    successResponse(res, result, 'تم تجديد الشهادة بنجاح');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /zatca/units/{id}/status:
 *   get:
 *     tags: [ZATCA]
 *     summary: عرض حالة وحدة ZATCA
 *     description: |
 *       يُعيد الحالة الحالية للوحدة، تاريخ انتهاء الشهادة، وآخر خطأ مسجَّل.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: تفاصيل حالة الوحدة
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ZatcaUnitStatusDetail'
 *       404:
 *         description: الوحدة غير موجودة
 */
export async function getUnitStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const unit = await prisma.zatcaUnit.findUniqueOrThrow({
      where: { id },
      include: { credentials: { select: { expiresAt: true } } }
    });
    
    const lastErrorLog = await prisma.zatcaLog.findFirst({
      where: { status: 'error' },
      orderBy: { createdAt: 'desc' },
      select: { errorMessage: true, createdAt: true }
    });

    successResponse(res, {
      id: unit.id,
      name: unit.name,
      environment: unit.environment,
      status: unit.status,
      expiresAt: unit.credentials?.expiresAt || null,
      lastError: lastErrorLog || null
    }, 'حالة الوحدة');
  } catch (e) { next(e); }
}
