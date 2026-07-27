import { Router } from 'express';
import { SupportController } from './support.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const supportController = new SupportController();

router.use(authenticate);

// Get ticket statistics
router.get(
  '/statistics',
  requirePermission('support:read'),
  supportController.getTicketStatistics
);

// Get all tickets
router.get(
  '/tickets',
  requirePermission('support:read'),
  validate([
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    query('category').optional().isString(),
  ]),
  supportController.getAllTickets
);

// Get ticket by ID
router.get(
  '/tickets/:id',
  requirePermission('support:read'),
  validate([param('id').isUUID()]),
  supportController.getTicketById
);

// Create ticket
router.post(
  '/tickets',
  requirePermission('support:create'),
  validate([
    body('title').notEmpty(),
    body('description').notEmpty(),
    body('category').notEmpty(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('assignedToId').optional().isUUID(),
  ]),
  supportController.createTicket
);

// Update ticket
router.put(
  '/tickets/:id',
  requirePermission('support:update'),
  validate([param('id').isUUID()]),
  supportController.updateTicket
);

// Add comment
router.post(
  '/tickets/:id/comments',
  requirePermission('support:update'),
  validate([
    param('id').isUUID(),
    body('message').notEmpty(),
    body('isInternal').optional().isBoolean(),
  ]),
  supportController.addComment
);

// Resolve ticket
router.put(
  '/tickets/:id/resolve',
  requirePermission('support:update'),
  validate([param('id').isUUID()]),
  supportController.resolveTicket
);

// Close ticket
router.put(
  '/tickets/:id/close',
  requirePermission('support:update'),
  validate([param('id').isUUID()]),
  supportController.closeTicket
);

export default router;
