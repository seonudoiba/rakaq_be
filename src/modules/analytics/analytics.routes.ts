import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { query } from 'express-validator';

const router = Router();
const analyticsController = new AnalyticsController();

router.use(authenticate);

// Get performance metrics
router.get(
  '/performance',
  requirePermission('analytics:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  analyticsController.getPerformanceMetrics
);

// Get trends analysis
router.get(
  '/trends',
  requirePermission('analytics:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('metric').optional().isString(),
  ]),
  analyticsController.getTrendsAnalysis
);

// Get station comparison
router.get(
  '/comparison',
  requirePermission('analytics:read'),
  validate([
    query('stationIds').optional().isString(),
    query('metric').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ]),
  analyticsController.getStationComparison
);

// Get predictive analytics
router.get(
  '/predictive',
  requirePermission('analytics:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('metric').optional().isString(),
  ]),
  analyticsController.getPredictiveAnalytics
);

// Get revenue forecast
router.get(
  '/forecast',
  requirePermission('analytics:read'),
  validate([
    query('stationId').optional().isUUID(),
    query('days').optional().isInt({ min: 1, max: 365 }),
  ]),
  analyticsController.getRevenueForecast
);

export default router;
