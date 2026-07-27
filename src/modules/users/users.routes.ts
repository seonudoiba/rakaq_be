import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const usersController = new UsersController();

// Apply authentication to all routes
router.use(authenticate);

// Get all users - Regional Manager has 'users:read' permission
router.get(
  '/',
  requirePermission('users:read'),
  validate([
    query('role').optional().isString(),
    query('stationId').optional().isUUID(),
    query('regionId').optional().isUUID(),
  ]),
  usersController.getAllUsers
);

// Get user by ID
router.get(
  '/:id',
  requirePermission('users:read'),
  validate([param('id').isUUID()]),
  usersController.getUserById
);

// Create user
router.post(
  '/',
  requirePermission('users:manage'),
  validate([
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('phone').notEmpty(),
    body('role').isIn(['SUPER_ADMIN', 'REGIONAL_MANAGER', 'SUPERVISOR', 'ATTENDANT', 'DEPOT_MANAGER', 'ACCOUNTANT']),
  ]),
  usersController.createUser
);

// Update user
router.put(
  '/:id',
  requirePermission('users:manage'),
  validate([param('id').isUUID()]),
  usersController.updateUser
);

// Delete user
router.delete(
  '/:id',
  requirePermission('users:manage'),
  validate([param('id').isUUID()]),
  usersController.deleteUser
);

// Change password
router.post(
  '/change-password',
  validate([
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ]),
  usersController.changePassword
);

export default router;