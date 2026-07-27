// src/routes/stations.routes.ts

import { Router } from 'express';
import { StationsController } from './stations.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { param, query, body } from 'express-validator';

const router = Router();
const stationsController = new StationsController();

// All routes require authentication
router.use(authenticate);

// Get all stations
router.get(
  '/',
  requirePermission('stations:read'),
  stationsController.getAllStations
);

// Get station by ID
router.get(
  '/:id',
  requirePermission('stations:read'),
  validate([param('id').isUUID()]),
  stationsController.getStationById
);

// ✅ ADD THIS: Get station dashboard data
router.get(
  '/:id/dashboard',
  requirePermission('stations:read'),
  validate([param('id').isUUID()]),
  stationsController.getStationDashboard
);

// Create station
router.post(
  '/',
  requirePermission('stations:create'),
  validate([
    body('name').notEmpty(),
    body('code').notEmpty(),
    body('address').notEmpty(),
    body('city').notEmpty(),
    body('state').notEmpty(),
    body('regionId').isUUID(),
  ]),
  stationsController.createStation
);

// Update station
router.put(
  '/:id',
  requirePermission('stations:update'),
  validate([param('id').isUUID()]),
  stationsController.updateStation
);

// Delete station
router.delete(
  '/:id',
  requirePermission('stations:delete'),
  validate([param('id').isUUID()]),
  stationsController.deleteStation
);

export default router;