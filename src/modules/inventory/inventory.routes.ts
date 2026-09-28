import { Router } from 'express';
import { getAll, getByProduct, getMovements, adjustment, lowStock } from './inventory.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/low-stock', lowStock);
router.get('/movements', getMovements);
router.get('/product/:productId', getByProduct);
router.post('/adjustment', adjustment);
export default router;
