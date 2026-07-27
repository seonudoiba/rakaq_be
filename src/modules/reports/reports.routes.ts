import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, query } from 'express-validator';

const router = Router();
const reportsController = new ReportsController();

router.use(authenticate);

// Generate sales report
router.post(
  '/sales',
  requirePermission('reports:generate'),
  validate([
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('groupBy').optional().isIn(['daily', 'weekly', 'monthly']),
    body('stationId').optional().isUUID(),
    body('productType').optional().isString(),
  ]),
  reportsController.generateSalesReport
);

// Generate financial report
router.post(
  '/financial',
  requirePermission('reports:generate'),
  validate([
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('stationId').optional().isUUID(),
  ]),
  reportsController.generateFinancialReport
);

// Generate inventory report
router.post(
  '/inventory',
  requirePermission('reports:generate'),
  validate([
    body('stationId').optional().isUUID(),
    body('productType').optional().isString(),
  ]),
  reportsController.generateInventoryReport
);

// Generate station report
router.post(
  '/station',
  requirePermission('reports:generate'),
  validate([
    body('stationId').isUUID(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ]),
  reportsController.generateStationReport
);

// Export report
router.post(
  '/export',
  requirePermission('reports:export'),
  validate([
    query('reportType').isString(),
    query('format').isIn(['pdf', 'excel', 'csv']),
  ]),
  reportsController.exportReport
);

export default router;
