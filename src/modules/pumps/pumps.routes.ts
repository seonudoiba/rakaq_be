import { Router } from 'express';
import { PumpsController } from './pumps.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const pumpsController = new PumpsController();

// All routes require authentication
router.use(authenticate);

// Get pump dashboard
router.get(
  '/dashboard',
  requirePermission('pumps:read'),
  validate([
    query('stationId').optional().isUUID(),
  ]),
  pumpsController.getPumpDashboard
);

// Get station pumps
router.get(
  '/station/:stationId',
  requirePermission('pumps:read'),
  validate([param('stationId').isUUID()]),
  pumpsController.getStationPumps
);

// Get pump by ID
router.get(
  '/:id',
  requirePermission('pumps:read'),
  validate([param('id').isUUID()]),
  pumpsController.getPumpById
);

// Create pump
router.post(
  '/',
  requirePermission('pumps:manage'),
  validate([
    body('pumpNumber').isInt({ min: 1 }),
    body('productType').isIn(['PMS', 'AGO', 'DPK']),
    body('stationId').optional().isUUID(),
    body('openingMeter').optional().isFloat({ min: 0 }),
  ]),
  pumpsController.createPump
);

// Update pump
router.put(
  '/:id',
  requirePermission('pumps:manage'),
  validate([param('id').isUUID()]),
  pumpsController.updatePump
);

// ✅ ADD DELETE ROUTE
router.delete(
  '/:id',
  requirePermission('pumps:manage'),
  validate([param('id').isUUID()]),
  pumpsController.deletePump
);

// Record pump reading
router.post(
  '/readings',
  requirePermission('pumps:record'),
  validate([
    body('pumpId').isUUID(),
    body('openingMeter').isFloat({ min: 0 }),
    body('closingMeter').isFloat({ min: 0 }),
    body('stationId').optional().isUUID(),
  ]),
  pumpsController.recordPumpReading
);

// Get pump readings
router.get(
  '/:pumpId/readings',
  requirePermission('pumps:read'),
  validate([
    param('pumpId').isUUID(),
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ]),
  pumpsController.getPumpReadings
);

export default router;