import { Router } from 'express';
import { login, register, refreshToken, logout, getMe, forgotPassword, resetPassword, googleLogin } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getAllRoles } from '../users/users.controller';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google', googleLogin);

// Public endpoint — used by frontend during registration to populate role dropdown
router.get('/roles', getAllRoles);

export default router;
