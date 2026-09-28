import { Router } from 'express';
import { getAll, getOne, create } from './returns.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
export default router;
