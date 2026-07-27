import { Router } from 'express';
import { ExpensesController } from './expenses.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const expensesController = new ExpensesController();

// All routes require authentication
router.use(authenticate);

// Get all expenses (for Super Admin with "All Stations")
router.get(
  '/all',
  requirePermission('expenses:read'),
  validate([
    query('category').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  expensesController.getAllExpenses
);

// Get expense summary - use query parameter instead of optional route param
router.get(
  '/summary',
  requirePermission('expenses:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
  ]),
  expensesController.getExpenseSummary
);

// Get pending approvals - use query parameter instead of optional route param
router.get(
  '/pending',
  requirePermission('expenses:read'),
  validate([
    query('stationId').optional().isUUID(),
  ]),
  expensesController.getPendingApprovals
);

// Get station expenses - stationId is path parameter
router.get(
  '/station/:stationId',
  requirePermission('expenses:read'),
  validate([
    param('stationId').isUUID(),
    query('category').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  expensesController.getStationExpenses
);

// Get expense by ID
router.get(
  '/:id',
  requirePermission('expenses:read'),
  validate([param('id').isUUID()]),
  expensesController.getExpenseById
);

// Create expense
router.post(
  '/',
  requirePermission('expenses:create'),
  validate([
    body('category').isIn(['FUEL_FOR_GENS', 'MAINTENANCE', 'SALARIES', 'UTILITIES', 'ADMINISTRATIVE', 'OPERATIONAL']),
    body('description').notEmpty().withMessage('Description is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('stationId').isUUID().withMessage('Valid station ID is required'),
    body('receiptUrl').optional().isString(),
  ]),
  expensesController.createExpense
);

// Approve expense
router.put(
  '/:id/approve',
  requirePermission('expenses:approve'),
  validate([param('id').isUUID()]),
  expensesController.approveExpense
);

// Delete expense
router.delete(
  '/:id',
  requirePermission('expenses:manage'),
  validate([param('id').isUUID()]),
  expensesController.deleteExpense
);

export default router;