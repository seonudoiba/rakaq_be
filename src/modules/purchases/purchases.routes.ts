import { Router } from 'express';
import { PurchasesController } from './purchases.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const purchasesController = new PurchasesController();

// All routes require authentication
router.use(authenticate);

// Get all purchase orders with filters
router.get(
  '/',
  requirePermission('purchases:read'),
  validate([
    query('status').optional().isString(),
    query('supplierId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('stationId').optional().isUUID(),
  ]),
  purchasesController.getAllPurchaseOrders
);

// Get purchase order summary
router.get(
  '/summary',
  requirePermission('purchases:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  purchasesController.getPurchaseOrderSummary
);

// Get purchase order by ID
router.get(
  '/:id',
  requirePermission('purchases:read'),
  validate([param('id').isUUID()]),
  purchasesController.getPurchaseOrderById
);

// Create purchase order
router.post(
  '/',
  requirePermission('purchases:create'),
  validate([
    body('supplierName').notEmpty(),
    body('productType').notEmpty(),
    body('volume').isFloat({ min: 0.01 }),
    body('unitCost').isFloat({ min: 0 }),
    body('expectedDelivery').optional().isISO8601(),
  ]),
  purchasesController.createPurchaseOrder
);

// Approve purchase order
router.put(
  '/:id/approve',
  requirePermission('purchases:approve'),
  validate([param('id').isUUID()]),
  purchasesController.approvePurchaseOrder
);

// Update purchase order status
router.put(
  '/:id/status',
  requirePermission('purchases:update'),
  validate([
    param('id').isUUID(),
    body('status').isIn(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  ]),
  purchasesController.updatePurchaseOrderStatus
);

// Cancel purchase order
router.put(
  '/:id/cancel',
  requirePermission('purchases:update'),
  validate([param('id').isUUID()]),
  purchasesController.cancelPurchaseOrder
);

export default router;
