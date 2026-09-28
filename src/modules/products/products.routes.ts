import { Router } from 'express';
import { getAll, getOne, getBySku, create, update, remove } from './products.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/sku/:sku', getBySku);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
export default router;
