import { Router } from 'express';
import { getAll, getOne, submit, status } from './invoices.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/:id/submit', submit);
router.get('/:id/status', status);
export default router;
