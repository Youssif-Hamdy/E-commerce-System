import { Router } from 'express';
import { getAll, getOne, create, cancel } from './sales.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id/cancel', cancel);
export default router;
