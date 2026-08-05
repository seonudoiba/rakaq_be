import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { PumpsService } from './pumps.service';
import { logger } from '../../config/logger';
import { getStringParam, getStringParamOrDefault } from '../../utils/helpers';

export class PumpsController {
  private pumpsService: PumpsService;

  constructor() {
    this.pumpsService = new PumpsService();
  }

  getStationPumps = async (req: AuthRequest, res: Response) => {
    try {
      let stationId = getStringParam(req.params.stationId) || 
                      getStringParamOrDefault(req.query.stationId) || 
                      req.user?.stationId || '';

      if (!stationId) {
        if (req.user?.role === 'SUPER_ADMIN') {
          const pumps = await this.pumpsService.getAllPumps();
          return res.json({
            success: true,
            data: pumps,
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'No station assigned to your account. Please contact your administrator.',
        });
      }

      const pumps = await this.pumpsService.getStationPumps(stationId);
      res.json({
        success: true,
        data: pumps,
      });
    } catch (error: any) {
      logger.error('Get station pumps error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get station pumps',
      });
    }
  };

  getPumpById = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Pump ID is required',
        });
      }
      const pump = await this.pumpsService.getPumpById(id);
      res.json({
        success: true,
        data: pump,
      });
    } catch (error: any) {
      logger.error('Get pump error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get pump',
      });
    }
  };

  createPump = async (req: AuthRequest, res: Response) => {
    try {
      // Get stationId from body, or user context
      let stationId = req.body.stationId || req.user?.stationId;
      
      // If Super Admin, stationId must be provided in the request body
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'stationId is required. Please provide a station ID.',
        });
      }

      const data = {
        stationId: stationId,
        pumpNumber: req.body.pumpNumber,
        productType: req.body.productType,
        openingMeter: req.body.openingMeter || 0,
        closingMeter: req.body.closingMeter || 0,
        tankId: req.body.tankId || undefined,
      };

      // Validate required fields
      if (!data.pumpNumber) {
        return res.status(400).json({
          success: false,
          message: 'Pump number is required',
        });
      }

      if (!data.productType) {
        return res.status(400).json({
          success: false,
          message: 'Product type is required',
        });
      }

      const pump = await this.pumpsService.createPump(data);
      res.status(201).json({
        success: true,
        message: 'Pump created successfully',
        data: pump,
      });
    } catch (error: any) {
      logger.error('Create pump error:', error);
      if (error.statusCode === 409) {
        res.status(409).json({
          success: false,
          message: error.message || 'Pump already exists at this station',
        });
      } else {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message || 'Failed to create pump',
        });
      }
    }
  };

  updatePump = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Pump ID is required',
        });
      }
      const pump = await this.pumpsService.updatePump(id, req.body);
      res.json({
        success: true,
        message: 'Pump updated successfully',
        data: pump,
      });
    } catch (error: any) {
      logger.error('Update pump error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update pump',
      });
    }
  };

  recordPumpReading = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        attendantId: req.user!.id,
        stationId: req.body.stationId || req.user?.stationId,
      };

      const reading = await this.pumpsService.recordPumpReading(data);
      res.status(201).json({
        success: true,
        message: 'Pump reading recorded successfully',
        data: reading,
      });
    } catch (error: any) {
      logger.error('Record pump reading error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to record pump reading',
      });
    }
  };

  getPumpReadings = async (req: AuthRequest, res: Response) => {
    try {
      const pumpId = getStringParam(req.params.pumpId);
      const startDate = getStringParam(req.query.startDate);
      const endDate = getStringParam(req.query.endDate);

      if (!pumpId) {
        return res.status(400).json({
          success: false,
          message: 'Pump ID is required',
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
      }

      const readings = await this.pumpsService.getPumpReadings(
        pumpId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: readings,
      });
    } catch (error: any) {
      logger.error('Get pump readings error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get pump readings',
      });
    }
  };

  getPumpDashboard = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParamOrDefault(req.query.stationId) || req.user?.stationId || '';
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const dashboard = await this.pumpsService.getPumpDashboard(stationId);
      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      logger.error('Get pump dashboard error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get pump dashboard',
      });
    }
  };
  deletePump = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Pump ID is required',
        });
      }

      await this.pumpsService.deletePump(id);
      res.json({
        success: true,
        message: 'Pump deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete pump error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete pump',
      });
    }
  };

}