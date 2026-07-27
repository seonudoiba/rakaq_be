import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validation';
import { body } from 'express-validator';

const router = Router();
const settingsController = new SettingsController();

// All routes require authentication
router.use(authenticate);

// Get user settings
router.get(
  '/',
  requirePermission('settings:read'),
  settingsController.getSettings
);

// Update user settings
router.put(
  '/',
  requirePermission('settings:update'),
  validate([
    body('theme').optional().isIn(['light', 'dark']),
    body('language').optional().isString(),
    body('timezone').optional().isString(),
    body('dateFormat').optional().isString(),
    body('notifications').optional().isObject(),
    body('preferences').optional().isObject(),
  ]),
  settingsController.updateSettings
);

// Get system settings
router.get(
  '/system',
  requirePermission('settings:read'),
  settingsController.getSystemSettings
);

// Update system settings
router.put(
  '/system',
  requirePermission('settings:manage'),
  validate([
    body('stationDefaults').optional().isObject(),
    body('pricing').optional().isObject(),
    body('notifications').optional().isObject(),
    body('security').optional().isObject(),
    body('integration').optional().isObject(),
  ]),
  settingsController.updateSystemSettings
);

// Update theme
router.put(
  '/theme',
  requirePermission('settings:update'),
  validate([
    body('theme').isIn(['light', 'dark']),
  ]),
  settingsController.updateTheme
);

// Update language
router.put(
  '/language',
  requirePermission('settings:update'),
  validate([
    body('language').isIn(['en', 'ha', 'yo', 'ig']),
  ]),
  settingsController.updateLanguage
);

export default router;
