import { Router } from 'express';
import { getAll, getOne, create, update, getAllRoles, createRoleHandler, updatePermissions, getAllPermissions } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authMiddleware);

// Users
router.get('/users', getAll);
router.get('/users/:id', getOne);
router.post('/users', create);
router.put('/users/:id', update);

// Roles
router.get('/roles', getAllRoles);
router.post('/roles', createRoleHandler);
router.put('/roles/:id/permissions', updatePermissions);

// Permissions
router.get('/permissions', getAllPermissions);

export default router;
