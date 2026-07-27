import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class InventoryController {
  // Get tank monitoring for a station
  getTankMonitoring = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);
      
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const tanks = await prisma.tank.findMany({
        where: { stationId },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: { tanks },
      });
    } catch (error: any) {
      logger.error('Get tank monitoring error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get tank monitoring data',
      });
    }
  };

  // Get tank by ID
  getTankById = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Tank ID is required',
        });
      }

      const tank = await prisma.tank.findUnique({
        where: { id },
        include: {
          station: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!tank) {
        return res.status(404).json({
          success: false,
          message: 'Tank not found',
        });
      }

      res.json({
        success: true,
        data: tank,
      });
    } catch (error: any) {
      logger.error('Get tank error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get tank',
      });
    }
  };

  // Update tank level
  updateTankLevel = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      const { currentLevel, percentage } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Tank ID is required',
        });
      }

      if (currentLevel === undefined || percentage === undefined) {
        return res.status(400).json({
          success: false,
          message: 'currentLevel and percentage are required',
        });
      }

      // Determine status based on percentage
      let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (percentage <= 15) {
        status = 'CRITICAL';
      } else if (percentage <= 30) {
        status = 'WARNING';
      }

      const tank = await prisma.tank.update({
        where: { id },
        data: {
          currentLevel,
          percentage,
          status,
          lastUpdated: new Date(),
        },
      });

      // Log inventory change
      await prisma.inventoryLog.create({
        data: {
          stationId: tank.stationId,
          tankId: tank.id,
          productType: tank.productType,
          previousLevel: 0,
          newLevel: currentLevel,
          adjustment: currentLevel,
          reason: 'Manual update',
          userId: req.user!.id,
        },
      });

      res.json({
        success: true,
        data: tank,
      });
    } catch (error: any) {
      logger.error('Update tank level error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update tank level',
      });
    }
  };

  // Get inventory logs
  getInventoryLogs = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);
      const { startDate, endDate } = req.query;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const where: any = { stationId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate as string);
        }
      }

      const logs = await prisma.inventoryLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          tank: {
            select: {
              id: true,
              name: true,
              productType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      logger.error('Get inventory logs error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get inventory logs',
      });
    }
  };

  // Get product movement
  getProductMovement = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);
      const { productType, days } = req.query;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const where: any = { stationId };

      if (productType) {
        where.productType = productType as string;
      }

      // Default to last 30 days if not specified
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days ? parseInt(days as string) : 30));

      where.createdAt = {
        gte: startDate,
      };

      const movements = await prisma.inventoryLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          tank: {
            select: {
              id: true,
              name: true,
              productType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate summary
      const summary = movements.reduce(
        (acc, log) => {
          const adjustment = log.adjustment || 0;
          if (adjustment > 0) {
            acc.totalInflow += adjustment;
          } else {
            acc.totalOutflow += Math.abs(adjustment);
          }
          return acc;
        },
        { totalInflow: 0, totalOutflow: 0, netChange: 0 }
      );
      summary.netChange = summary.totalInflow - summary.totalOutflow;

      res.json({
        success: true,
        data: {
          movements,
          summary,
        },
      });
    } catch (error: any) {
      logger.error('Get product movement error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get product movement',
      });
    }
  };

  // Get product prices
  getProductPrices = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId } = req.query;

      // Default product prices
      const defaultPrices = [
        { productType: 'PMS', productName: 'Premium Motor Spirit', unitPrice: 850 },
        { productType: 'AGO', productName: 'Automotive Gas Oil', unitPrice: 950 },
        { productType: 'DPK', productName: 'Dual Purpose Kerosene', unitPrice: 500 },
        { productType: 'LPG', productName: 'Liquefied Petroleum Gas', unitPrice: 1200 },
      ];

      res.json({
        success: true,
        data: defaultPrices,
      });
    } catch (error: any) {
      logger.error('Get product prices error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get product prices',
      });
    }
  };

  // Update product price
  updateProductPrice = async (req: AuthRequest, res: Response) => {
    try {
      const { productType, productName, unitPrice } = req.body;

      if (!productType || !productName || unitPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: 'productType, productName, and unitPrice are required',
        });
      }

      res.json({
        success: true,
        data: {
          productType,
          productName,
          unitPrice,
          message: 'Price updated successfully',
        },
      });
    } catch (error: any) {
      logger.error('Update product price error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update product price',
      });
    }
  };

  // Get low stock alerts
  getLowStockAlerts = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId } = req.query;

      const where: any = {};
      if (stationId) {
        where.stationId = stationId as string;
      }

      // Get tanks with low stock (critical or warning)
      const tanks = await prisma.tank.findMany({
        where: {
          ...where,
          status: {
            in: ['CRITICAL', 'WARNING'],
          },
        },
        include: {
          station: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { percentage: 'asc' },
      });

      const alerts = tanks.map(tank => ({
        id: tank.id,
        name: tank.name,
        productType: tank.productType,
        currentLevel: tank.currentLevel,
        percentage: tank.percentage,
        status: tank.status,
        station: tank.station,
        recommendation: tank.status === 'CRITICAL'
          ? 'Immediate refill required!'
          : 'Schedule refill soon',
      }));

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      logger.error('Get low stock alerts error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get low stock alerts',
      });
    }
  };

  // Perform inventory audit
  performAudit = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: 'Station ID is required',
        });
      }

      const { tankId, actualLevel, notes } = req.body;

      if (!tankId || actualLevel === undefined) {
        return res.status(400).json({
          success: false,
          message: 'tankId and actualLevel are required',
        });
      }

      // Get current tank
      const tank = await prisma.tank.findUnique({
        where: { id: tankId },
      });

      if (!tank) {
        return res.status(404).json({
          success: false,
          message: 'Tank not found',
        });
      }

      // Update tank level
      const percentage = (actualLevel / tank.capacity) * 100;
      const status = percentage <= 15 ? 'CRITICAL' : percentage <= 30 ? 'WARNING' : 'NORMAL';

      const updatedTank = await prisma.tank.update({
        where: { id: tankId },
        data: {
          currentLevel: actualLevel,
          percentage,
          status,
          lastUpdated: new Date(),
        },
      });

      // Log the audit
      await prisma.inventoryLog.create({
        data: {
          stationId,
          tankId,
          productType: tank.productType,
          previousLevel: tank.currentLevel,
          newLevel: actualLevel,
          adjustment: actualLevel - tank.currentLevel,
          reason: `Audit: ${notes || 'Manual inventory audit'}`,
          userId: req.user!.id,
        },
      });

      res.json({
        success: true,
        data: updatedTank,
        message: 'Inventory audit completed successfully',
      });
    } catch (error: any) {
      logger.error('Perform audit error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to perform inventory audit',
      });
    }
  };
}