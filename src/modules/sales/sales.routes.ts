import { Router } from 'express';
import { SalesController } from './sales.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const salesController = new SalesController();

// All routes require authentication
router.use(authenticate);

// Get daily report - use query parameter
router.get(
  '/daily',
  requirePermission('sales:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('date').optional().isISO8601(),
  ]),
  salesController.getDailyReport
);

// Get monthly report
router.get(
  '/monthly',
  requirePermission('sales:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2020 }),
  ]),
  salesController.getMonthlyReport
);

// Create sale
router.post(
  '/',
  requirePermission('sales:create'),
  validate([
    body('productType').notEmpty(),
    body('productName').notEmpty(),
    body('quantity').isFloat({ min: 0.01 }),
    body('unitPrice').isFloat({ min: 0 }),
    body('paymentMethod').isIn(['CASH', 'POS', 'TRANSFER', 'CREDIT']),
  ]),
  salesController.createSale
);

// Verify sale
router.put(
  '/:saleId/verify',
  requirePermission('sales:reconcile'),
  validate([param('saleId').isUUID()]),
  salesController.verifySale
);

// Get station sales with date range
router.get(
  '/station/:stationId',
  requirePermission('sales:read'),
  validate([
    param('stationId').isUUID(),
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ]),
  salesController.getStationSales
);

// Get sales by product
router.get(
  '/by-product/:stationId',
  requirePermission('sales:read'),
  validate([
    param('stationId').isUUID(),
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ]),
  salesController.getSalesByProduct
);

// Get credit customers
router.get(
  '/credits/:stationId',
  requirePermission('sales:read'),
  validate([param('stationId').isUUID()]),
  salesController.getCreditCustomers
);

export default router;