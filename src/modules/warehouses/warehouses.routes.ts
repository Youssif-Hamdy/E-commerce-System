import { Router } from 'express';
import { getAll, create } from './warehouses.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.post('/', create);
export default router;
