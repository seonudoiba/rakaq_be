import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { authLimiter } from '../../middleware/rateLimiter';
import { body } from 'express-validator';

const router = Router();
const authController = new AuthController();

// Public routes with rate limiting
router.post(
  '/register',
  authLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('phone').notEmpty(),
    body('role').isIn(['SUPER_ADMIN', 'REGIONAL_MANAGER', 'SUPERVISOR', 'ATTENDANT', 'ACCOUNTANT']),
  ]),
  authController.register
);

router.post(
  '/login',
  authLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ]),
  authController.login
);

router.post(
  '/refresh',
  validate([
    body('refreshToken').notEmpty(),
  ]),
  authController.refresh
);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ]),
  authController.changePassword
);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
