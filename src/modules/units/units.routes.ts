import { Router } from 'express';
import { getAll, create, update } from './units.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
export default router;
