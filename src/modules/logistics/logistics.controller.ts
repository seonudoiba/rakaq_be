import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { LogisticsService } from './logistics.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class LogisticsController {
  private logisticsService: LogisticsService;

  constructor() {
    this.logisticsService = new LogisticsService();
  }

  getAllDeliveries = async (req: AuthRequest, res: Response) => {
    try {
      const { status, stationId, startDate, endDate } = req.query;
      
      let filterStationId = stationId as string;
      if (req.user?.role === 'SUPERVISOR') {
        filterStationId = req.user.stationId!;
      }

      const deliveries = await this.logisticsService.getAllDeliveries({
        status: status as string,
        stationId: filterStationId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length,
      });
    } catch (error: any) {
      logger.error('Get deliveries error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get deliveries',
      });
    }
  };

  getDeliveryById = async (req: AuthRequest, res: Response) => {
    try {
      const delivery = await this.logisticsService.getDeliveryById(getStringParam(req.params.id));
      res.json({
        success: true,
        data: delivery,
      });
    } catch (error: any) {
      logger.error('Get delivery error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get delivery',
      });
    }
  };

  createDelivery = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        createdById: req.user!.id,
      };

      const delivery = await this.logisticsService.createDelivery(data);
      res.status(201).json({
        success: true,
        message: 'Delivery created successfully',
        data: delivery,
      });
    } catch (error: any) {
      logger.error('Create delivery error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create delivery',
      });
    }
  };

  updateDeliveryStatus = async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      const delivery = await this.logisticsService.updateDeliveryStatus(
        getStringParam(req.params.id),
        status,
        req.body
      );
      res.json({
        success: true,
        message: 'Delivery status updated successfully',
        data: delivery,
      });
    } catch (error: any) {
      logger.error('Update delivery status error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update delivery status',
      });
    }
  };

  trackDelivery = async (req: AuthRequest, res: Response) => {
    try {
      const tracking = await this.logisticsService.trackDelivery(getStringParam(req.params.id));
      res.json({
        success: true,
        data: tracking,
      });
    } catch (error: any) {
      logger.error('Track delivery error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to track delivery',
      });
    }
  };

  addLocationLog = async (req: AuthRequest, res: Response) => {
    try {
      const log = await this.logisticsService.addLocationLog({
        ...req.body,
        deliveryId: getStringParam(req.params.id),
      });
      res.status(201).json({
        success: true,
        message: 'Location log added successfully',
        data: log,
      });
    } catch (error: any) {
      logger.error('Add location log error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to add location log',
      });
    }
  };

  getFleetStatus = async (req: AuthRequest, res: Response) => {
    try {
      const status = await this.logisticsService.getFleetStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Get fleet status error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get fleet status',
      });
    }
  };
}