import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';
import { InventoryService } from './inventory.service';

export class InventoryController {
  private inventoryService = new InventoryService();
  
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

      const data = await this.inventoryService.getTankMonitoring(stationId);

      res.json({
        success: true,
        data,
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

      const tank = await this.inventoryService.getTankById(id);

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

  // Create a new tank
  createTank = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, name, productType, capacity, currentLevel } = req.body;

      if (!stationId || !name || !productType || !capacity) {
        return res.status(400).json({
          success: false,
          message: 'stationId, name, productType, and capacity are required',
        });
      }

      const tank = await this.inventoryService.createTank({
        stationId,
        name,
        productType,
        capacity,
        currentLevel: currentLevel || 0,
        userId: req.user?.id,
      });

      res.status(201).json({
        success: true,
        data: tank,
        message: 'Tank created successfully',
      });
    } catch (error: any) {
      logger.error('Create tank error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create tank',
      });
    }
  };

  // Update tank details
  updateTank = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      const { name, productType, capacity, currentLevel } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Tank ID is required',
        });
      }

      const tank = await this.inventoryService.updateTank(id, {
        name,
        productType,
        capacity,
        currentLevel,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        data: tank,
        message: 'Tank updated successfully',
      });
    } catch (error: any) {
      logger.error('Update tank error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update tank',
      });
    }
  };

  // Delete tank
  deleteTank = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Tank ID is required',
        });
      }

      await this.inventoryService.deleteTank(id);

      res.json({
        success: true,
        message: 'Tank deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete tank error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete tank',
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

      const tank = await this.inventoryService.updateTankLevel(id, { currentLevel, percentage });

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

      const logs = await this.inventoryService.getInventoryLogs(
        stationId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

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

      const data = await this.inventoryService.getProductMovement(
        stationId,
        productType as string,
        days ? parseInt(days as string) : 30
      );

      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      logger.error('Get product movement error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get product movement',
      });
    }
  };

  // Get product prices - FIXED: Proper route handler
  getProductPrices = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, regionId } = req.query;

      // Use the service to get prices from database
      const prices = await this.inventoryService.getProductPrices(
        stationId as string,
        regionId as string
      );

      res.json({
        success: true,
        data: prices,
      });
    } catch (error: any) {
      logger.error('Get product prices error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get product prices',
      });
    }
  };

  // Update product price - FIXED: Proper route handler with scope support
  updateProductPrice = async (req: AuthRequest, res: Response) => {
    try {
      const { 
        stationId, 
        regionId,
        productType, 
        productName, 
        unitPrice,
        applyToAll
      } = req.body;

      if (!productType || !productName || unitPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: 'productType, productName, and unitPrice are required',
        });
      }

      // Use the inventory service to update the price
      const price = await this.inventoryService.updateProductPrice({
        stationId: stationId || undefined,
        regionId: regionId || undefined,
        productType,
        productName,
        unitPrice,
        userId: req.user!.id,
        applyToAll: applyToAll || false,
      });

      res.json({
        success: true,
        data: price,
        message: 'Price updated successfully',
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

      const alerts = await this.inventoryService.getLowStockAlerts(stationId as string);

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

      const result = await this.inventoryService.performAudit(stationId, {
        tankId,
        actualLevel,
        notes,
      });

      res.json({
        success: true,
        data: result,
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