import { Router } from 'express';
import { getStatus, onboarding, testConnection, getLogs } from './zatca.controller';
import * as onboardCtrl from './onboarding.controller';
import { createUnitSchema, otpSchema, unitIdParamSchema, generateCsrSchema } from './onboarding.schema';
import { validateRequest } from './validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/role.middleware';

const router = Router();
router.use(authMiddleware);

// --- Legacy / Global Endpoints ---
router.get('/status', getStatus);
router.post('/onboarding', onboarding);
router.post('/test', testConnection);
router.get('/logs', requirePermission('zatca:view'), getLogs);

// --- Multi-Unit Onboarding Endpoints (Phase 4) ---
const onboardAccess = requirePermission('zatca:onboard');
const viewAccess = requirePermission('zatca:view');

// Create a new ZATCA Unit
router.post('/units', 
  onboardAccess, 
  validateRequest(createUnitSchema), 
  onboardCtrl.createUnit
);

// 1. Generate CSR & Keys
router.post('/units/:id/csr', 
  onboardAccess, 
  validateRequest(generateCsrSchema), 
  onboardCtrl.generateCsr
);

// 2. Request Compliance CSID
router.post('/units/:id/compliance', 
  onboardAccess, 
  validateRequest(unitIdParamSchema), // URL param
  validateRequest(otpSchema),         // Body OTP
  onboardCtrl.requestCompliance
);

// 3. Run Compliance Checks (Send mock invoices)
router.post('/units/:id/compliance-check', 
  onboardAccess, 
  validateRequest(unitIdParamSchema), 
  onboardCtrl.runComplianceCheck
);

// 4. Request Production CSID
router.post('/units/:id/production', 
  onboardAccess, 
  validateRequest(unitIdParamSchema), 
  onboardCtrl.requestProduction
);

// 5. Renew Certificate
router.post('/units/:id/renew', 
  onboardAccess, 
  validateRequest(unitIdParamSchema),
  validateRequest(otpSchema),
  onboardCtrl.renewCertificate
);

// Get Unit Status
router.get('/units/:id/status', 
  viewAccess, 
  validateRequest(unitIdParamSchema), 
  onboardCtrl.getUnitStatus
);

export default router;
