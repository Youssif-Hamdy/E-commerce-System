import { Router } from 'express';
import { salesReport, inventoryReport, purchasesReport, profitReport } from './reports.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/sales', salesReport);
router.get('/inventory', inventoryReport);
router.get('/purchases', purchasesReport);
router.get('/profit', profitReport);
export default router;
