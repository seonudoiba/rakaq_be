import { Router } from 'express';
import { RegionsController } from './regions.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param } from 'express-validator';

const router = Router();
const regionsController = new RegionsController();

// All routes require authentication
router.use(authenticate);

// Get all regions
router.get(
  '/',
  requirePermission('stations:read'),
  regionsController.getAllRegions
);

// Get region by ID
router.get(
  '/:id',
  requirePermission('stations:read'),
  validate([param('id').isUUID()]),
  regionsController.getRegionById
);

// Create region
router.post(
  '/',
  requirePermission('stations:manage'),
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('code').notEmpty().withMessage('Code is required'),
    body('description').optional().isString(),
  ]),
  regionsController.createRegion
);

// Update region
router.put(
  '/:id',
  requirePermission('stations:manage'),
  validate([
    param('id').isUUID(),
    body('name').optional().notEmpty(),
    body('code').optional().notEmpty(),
    body('description').optional().isString(),
  ]),
  regionsController.updateRegion
);

// Delete region
router.delete(
  '/:id',
  requirePermission('stations:manage'),
  validate([param('id').isUUID()]),
  regionsController.deleteRegion
);

export default router;