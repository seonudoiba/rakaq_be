import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AnalyticsService } from './analytics.service';
import { logger } from '../../config/logger';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  getPerformanceMetrics = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate } = req.query;
      
      const metrics = await this.analyticsService.getPerformanceMetrics({
        stationId: (stationId as string) || req.user?.stationId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get performance metrics error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get performance metrics',
      });
    }
  };

  getTrendsAnalysis = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate, metric } = req.query;
      
      const trends = await this.analyticsService.getTrendsAnalysis({
        stationId: (stationId as string) || req.user?.stationId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        metric: metric as string,
      });

      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Get trends analysis error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get trends analysis',
      });
    }
  };

  getStationComparison = async (req: AuthRequest, res: Response) => {
    try {
      const { stationIds, metric, startDate, endDate } = req.query;
      
      const comparison = await this.analyticsService.getStationComparison({
        stationIds: stationIds ? (stationIds as string).split(',') : [],
        metric: metric as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      logger.error('Get station comparison error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get station comparison',
      });
    }
  };

  getPredictiveAnalytics = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, metric } = req.query;
      
      const predictions = await this.analyticsService.getPredictiveAnalytics({
        stationId: (stationId as string) || req.user?.stationId,
        metric: metric as string,
      });

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error: any) {
      logger.error('Get predictive analytics error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get predictive analytics',
      });
    }
  };

  getRevenueForecast = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, days } = req.query;
      
      const forecast = await this.analyticsService.getRevenueForecast({
        stationId: (stationId as string) || req.user?.stationId,
        days: days ? parseInt(days as string) : 30,
      });

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error: any) {
      logger.error('Get revenue forecast error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get revenue forecast',
      });
    }
  };
}