import { Router } from 'express';
import { getAll, getByProduct, getMovements, adjustment, lowStock, transfer } from './inventory.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/low-stock', lowStock);
router.get('/movements', getMovements);
router.get('/product/:productId', getByProduct);
router.post('/adjustment', adjustment);
router.post('/transfer', transfer);
export default router;
