import { Router } from 'express';
import { getAll, getOne, start, submitItems, approve } from './stock-counts.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.post('/', start);
router.get('/:id', getOne);
router.put('/:id/items', submitItems);
router.post('/:id/approve', approve);
export default router;
