import { Router } from 'express';
import { EmployeesController } from './employees.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const employeesController = new EmployeesController();

router.use(authenticate);

// Get employee statistics
router.get(
  '/statistics',
  requirePermission('employees:read'),
  validate([
    query('stationId').optional().isUUID(),
  ]),
  employeesController.getEmployeeStatistics
);

// Get all employees
router.get(
  '/',
  requirePermission('employees:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('department').optional().isString(),
    query('position').optional().isString(),
  ]),
  employeesController.getAllEmployees
);

// Get employee by ID
router.get(
  '/:id',
  requirePermission('employees:read'),
  validate([param('id').isUUID()]),
  employeesController.getEmployeeById
);

// Get employee by user ID
router.get(
  '/user/:userId',
  requirePermission('employees:read'),
  validate([param('userId').isUUID()]),
  employeesController.getEmployeeByUserId
);

// Create employee
router.post(
  '/',
  requirePermission('employees:manage'),
  validate([
    body('userId').isUUID(),
    body('position').notEmpty(),
    body('department').notEmpty(),
    body('hireDate').isISO8601(),
    body('salary').optional().isFloat({ min: 0 }),
  ]),
  employeesController.createEmployee
);

// Update employee
router.put(
  '/:id',
  requirePermission('employees:manage'),
  validate([param('id').isUUID()]),
  employeesController.updateEmployee
);

// Delete employee
router.delete(
  '/:id',
  requirePermission('employees:manage'),
  validate([param('id').isUUID()]),
  employeesController.deleteEmployee
);

export default router;
