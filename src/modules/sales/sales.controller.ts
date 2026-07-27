import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { SalesService } from './sales.service';
import { logger } from '../../config/logger';
import { getStringParam, getStringParamOrDefault } from '../../utils/helpers';

export class SalesController {
  private salesService: SalesService;

  constructor() {
    this.salesService = new SalesService();
  }

  getDailyReport = async (req: AuthRequest, res: Response) => {
    try {
      // Get stationId from query parameter OR from the user context
      const stationId = getStringParamOrDefault(req.query.stationId) || req.user?.stationId || '';
      
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required. Please provide stationId as query parameter.',
        });
      }

      const date = req.query.date ? new Date(req.query.date as string) : new Date();

      const report = await this.salesService.getDailyReport(stationId, date);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get daily report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get daily report',
      });
    }
  };

  getMonthlyReport = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParamOrDefault(req.query.stationId) || req.user?.stationId || '';
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const report = await this.salesService.getMonthlyReport(stationId, month, year);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get monthly report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get monthly report',
      });
    }
  };

  
  createSale = async (req: AuthRequest, res: Response) => {
    try {
      // Log the request body for debugging
      console.log('📝 Create sale request body:', JSON.stringify(req.body, null, 2));
      
      // Get stationId from body or user context
      let stationId = req.body.stationId || req.user?.stationId;
      
      // If user is Super Admin, they must provide stationId in body
      if (req.user?.role === 'SUPER_ADMIN' && !stationId) {
        return res.status(400).json({
          success: false,
          message: 'stationId is required for Super Admin. Please select a station.',
        });
      }

      // If stationId is still missing, return error
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'stationId is required. Please provide a valid station ID.',
        });
      }

      const data = {
        ...req.body,
        stationId: stationId,
        attendantId: req.user!.id,
      };

      const sale = await this.salesService.createSale(data, req.user?.role);

      res.status(201).json({
        success: true,
        message: 'Sale recorded successfully',
        data: sale,
      });
    } catch (error: any) {
      logger.error('Create sale error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to record sale',
      });
    }
  };

  verifySale = async (req: AuthRequest, res: Response) => {
    try {
      const saleId = getStringParam(req.params.saleId);
      if (!saleId) {
        return res.status(400).json({
          success: false,
          message: 'Sale ID is required',
        });
      }
      const sale = await this.salesService.verifySale(saleId, req.user!.id);

      res.json({
        success: true,
        message: 'Sale verified successfully',
        data: sale,
      });
    } catch (error: any) {
      logger.error('Verify sale error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to verify sale',
      });
    }
  };

  getStationSales = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId) || req.user?.stationId || '';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required',
        });
      }

      const sales = await this.salesService.getStationSales(
        stationId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: sales,
      });
    } catch (error: any) {
      logger.error('Get station sales error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get sales',
      });
    }
  };

  getSalesByProduct = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId) || req.user?.stationId || '';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const sales = await this.salesService.getSalesByProduct(
        stationId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: sales,
      });
    } catch (error: any) {
      logger.error('Get sales by product error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get sales by product',
      });
    }
  };

  getCreditCustomers = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId) || req.user?.stationId || '';
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }
      const credits = await this.salesService.getCreditCustomers(stationId);

      res.json({
        success: true,
        data: credits,
      });
    } catch (error: any) {
      logger.error('Get credit customers error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get credit customers',
      });
    }
  };
}