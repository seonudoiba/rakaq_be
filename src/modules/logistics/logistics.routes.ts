import { Router } from 'express';
import { LogisticsController } from './logistics.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const logisticsController = new LogisticsController();

router.use(authenticate);

// Get fleet status
router.get(
  '/fleet/status',
  requirePermission('logistics:read'),
  logisticsController.getFleetStatus
);

// Get all deliveries
router.get(
  '/deliveries',
  requirePermission('logistics:read'),
  validate([
    query('status').optional().isString(),
    query('stationId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  logisticsController.getAllDeliveries
);

// Get delivery by ID
router.get(
  '/deliveries/:id',
  requirePermission('logistics:read'),
  validate([param('id').isUUID()]),
  logisticsController.getDeliveryById
);

// Track delivery
router.get(
  '/deliveries/:id/track',
  requirePermission('logistics:read'),
  validate([param('id').isUUID()]),
  logisticsController.trackDelivery
);

// Create delivery
router.post(
  '/deliveries',
  requirePermission('logistics:manage'),
  validate([
    body('purchaseOrderId').isUUID(),
    body('tankerId').notEmpty(),
    body('volume').isFloat({ min: 0.01 }),
    body('driverName').optional().isString(),
    body('driverPhone').optional().isString(),
  ]),
  logisticsController.createDelivery
);

// Update delivery status
router.put(
  '/deliveries/:id/status',
  requirePermission('logistics:manage'),
  validate([
    param('id').isUUID(),
    body('status').isIn(['IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CANCELLED']),
  ]),
  logisticsController.updateDeliveryStatus
);

// Add location log
router.post(
  '/deliveries/:id/location',
  requirePermission('logistics:manage'),
  validate([
    param('id').isUUID(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ]),
  logisticsController.addLocationLog
);

export default router;
