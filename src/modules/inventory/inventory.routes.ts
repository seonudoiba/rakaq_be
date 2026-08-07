import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { param, query, body } from 'express-validator';

const router = Router();
const inventoryController = new InventoryController();

// All routes require authentication
router.use(authenticate);

// Get product prices
router.get(
  '/prices',
  requirePermission('inventory:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('regionId').optional().isUUID(),
  ]),
  inventoryController.getProductPrices
);

// Update product price
router.put(
  '/prices',
  requirePermission('inventory:update'),
  validate([
    body('stationId').optional().isUUID(),
    body('regionId').optional().isUUID(),
    body('productType').notEmpty(),
    body('productName').notEmpty(),
    body('unitPrice').isFloat({ min: 0 }),
    body('applyToAll').optional().isBoolean(),
  ]),
  inventoryController.updateProductPrice
);

// Get tank monitoring for a station
router.get(
  '/tanks/:stationId',
  requirePermission('inventory:read'),
  validate([param('stationId').isUUID()]),
  inventoryController.getTankMonitoring
);

// Get tank by ID
router.get(
  '/tanks/detail/:id',
  requirePermission('inventory:read'),
  validate([param('id').isUUID()]),
  inventoryController.getTankById
);

// Create a new tank
router.post(
  '/tanks',
  requirePermission('inventory:update'),
  validate([
    body('stationId').isUUID(),
    body('name').notEmpty(),
    body('productType').notEmpty(),
    body('capacity').isFloat({ min: 0 }),
    body('currentLevel').optional().isFloat({ min: 0 }),
  ]),
  inventoryController.createTank
);

// Update tank details
router.put(
  '/tanks/:id',
  requirePermission('inventory:update'),
  validate([
    param('id').isUUID(),
    body('name').optional().notEmpty(),
    body('productType').optional().notEmpty(),
    body('capacity').optional().isFloat({ min: 0 }),
    body('currentLevel').optional().isFloat({ min: 0 }),
  ]),
  inventoryController.updateTank
);

// Delete tank
router.delete(
  '/tanks/:id',
  requirePermission('inventory:update'),
  validate([param('id').isUUID()]),
  inventoryController.deleteTank
);

// Update tank level
router.put(
  '/tanks/:id/level',
  requirePermission('inventory:update'),
  validate([
    param('id').isUUID(),
    body('currentLevel').isFloat({ min: 0 }),
    body('percentage').isFloat({ min: 0, max: 100 }),
  ]),
  inventoryController.updateTankLevel
);

// Get inventory logs
router.get(
  '/logs/:stationId',
  requirePermission('inventory:read'),
  validate([
    param('stationId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  inventoryController.getInventoryLogs
);

// Get product movement
router.get(
  '/movement/:stationId',
  requirePermission('inventory:read'),
  validate([
    param('stationId').isUUID(),
    query('productType').optional().isString(),
    query('days').optional().isInt({ min: 1 }),
  ]),
  inventoryController.getProductMovement
);

// Get low stock alerts
router.get(
  '/alerts',
  requirePermission('inventory:read'),
  validate([query('stationId').optional().isUUID()]),
  inventoryController.getLowStockAlerts
);

// Perform inventory audit
router.post(
  '/audit/:stationId',
  requirePermission('inventory:update'),
  validate([param('stationId').isUUID()]),
  inventoryController.performAudit
);

export default router;