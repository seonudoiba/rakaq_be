import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { StationSettingsService } from './stationSettings.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class StationSettingsController {
  private stationSettingsService: StationSettingsService;

  constructor() {
    this.stationSettingsService = new StationSettingsService();
  }

  getStationSettings = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);
      
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const settings = await this.stationSettingsService.getStationSettings(stationId);
      res.json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      logger.error('Get station settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get station settings',
      });
    }
  };

  updateStationSettings = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);
      
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      // Only Super Admin and Regional Manager can update settings
      if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'REGIONAL_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only Super Admin and Regional Managers can update station settings.',
        });
      }

      const settings = await this.stationSettingsService.updateStationSettings(stationId, req.body);
      res.json({
        success: true,
        message: 'Station settings updated successfully',
        data: settings,
      });
    } catch (error: any) {
      logger.error('Update station settings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update station settings',
      });
    }
  };
}