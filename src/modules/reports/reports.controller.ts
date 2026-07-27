import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ReportsService } from './reports.service';
import { logger } from '../../config/logger';

export class ReportsController {
  private reportsService: ReportsService;

  constructor() {
    this.reportsService = new ReportsService();
  }

  generateSalesReport = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate, groupBy, productType } = req.body;
      
      const report = await this.reportsService.generateSalesReport({
        stationId: stationId || req.user?.stationId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        groupBy,
        productType,
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Generate sales report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate sales report',
      });
    }
  };

  generateFinancialReport = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate } = req.body;
      
      const report = await this.reportsService.generateFinancialReport({
        stationId: stationId || req.user?.stationId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Generate financial report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate financial report',
      });
    }
  };

  generateInventoryReport = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, productType } = req.body;
      
      const report = await this.reportsService.generateInventoryReport({
        stationId: stationId || req.user?.stationId,
        productType,
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Generate inventory report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate inventory report',
      });
    }
  };

  generateStationReport = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate } = req.body;
      
      const report = await this.reportsService.generateStationReport({
        stationId: stationId || req.user?.stationId!,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Generate station report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate station report',
      });
    }
  };

  exportReport = async (req: AuthRequest, res: Response) => {
    try {
      const { reportType, format } = req.query;
      const data = req.body;
      
      const exportData = await this.reportsService.exportReport(
        reportType as string,
        data,
        format as string
      );

      res.json({
        success: true,
        data: exportData,
      });
    } catch (error: any) {
      logger.error('Export report error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to export report',
      });
    }
  };
}