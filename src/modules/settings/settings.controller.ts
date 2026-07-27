import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { SettingsService } from './settings.service';
import { logger } from '../../config/logger';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  getSettings = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const settings = await this.settingsService.getSettings(userId);
      res.json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      logger.error('Get settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get settings',
      });
    }
  };

  updateSettings = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const settings = await this.settingsService.updateSettings(userId, req.body);
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: settings,
      });
    } catch (error: any) {
      logger.error('Update settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update settings',
      });
    }
  };

  getSystemSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingsService.getSystemSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      logger.error('Get system settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get system settings',
      });
    }
  };

  updateSystemSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingsService.updateSystemSettings(req.body);
      res.json({
        success: true,
        message: 'System settings updated successfully',
        data: settings,
      });
    } catch (error: any) {
      logger.error('Update system settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update system settings',
      });
    }
  };

  updateTheme = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { theme } = req.body;
      const settings = await this.settingsService.updateTheme(userId, theme);
      res.json({
        success: true,
        message: 'Theme updated successfully',
        data: settings,
      });
    } catch (error: any) {
      logger.error('Update theme error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update theme',
      });
    }
  };

  updateLanguage = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { language } = req.body;
      const settings = await this.settingsService.updateLanguage(userId, language);
      res.json({
        success: true,
        message: 'Language updated successfully',
        data: settings,
      });
    } catch (error: any) {
      logger.error('Update language error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update language',
      });
    }
  };
}