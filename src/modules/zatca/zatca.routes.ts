import { Router } from 'express';
import { getStatus, onboarding, testConnection, getLogs } from './zatca.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/status', getStatus);
router.post('/onboarding', onboarding);
router.post('/test', testConnection);
router.get('/logs', getLogs);
export default router;
