import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';
import { TankStatus } from '@prisma/client';
import { StationSettingsService } from './../stationSettings/stationSettings.service';

export class InventoryService {
  private readonly cacheTTL = 300;
  private stationSettingsService = new StationSettingsService();

  async getTankMonitoring(stationId: string) {
    const cacheKey = `inventory:tanks:${stationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tanks = await prisma.tank.findMany({
      where: { stationId },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = {
      tanks,
      summary: {
        total: tanks.length,
        normal: tanks.filter(t => t.status === TankStatus.NORMAL).length,
        warning: tanks.filter(t => t.status === TankStatus.WARNING).length,
        critical: tanks.filter(t => t.status === TankStatus.CRITICAL).length,
      },
    };

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));
    return result;
  }

  async getTankById(id: string) {
    const cacheKey = `inventory:tank:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

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
        inventoryLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!tank) {
      throw new AppError('Tank not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(tank));
    return tank;
  }

  async updateTankLevel(id: string, data: { currentLevel: number; percentage: number }) {
    const tank = await prisma.tank.update({
      where: { id },
      data: {
        currentLevel: data.currentLevel,
        percentage: data.percentage,
        lastUpdated: new Date(),
        status: data.percentage < 20 ? TankStatus.CRITICAL :
                data.percentage < 35 ? TankStatus.WARNING :
                TankStatus.NORMAL,
      },
    });

    await prisma.inventoryLog.create({
      data: {
        stationId: tank.stationId,
        tankId: tank.id,
        productType: tank.productType,
        previousLevel: 0,
        newLevel: data.currentLevel,
        adjustment: data.currentLevel,
        reason: 'Manual level update',
        userId: 'system',
      },
    });

    await this.invalidateCache(tank.stationId, id);
    return tank;
  }

  async updateTankLevelFromSale(stationId: string, tankId: string, actualQuantity: number, userId: string) {
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
    });

    if (!tank) {
      throw new AppError('Tank not found', 404);
    }

    const newLevel = Math.max(0, tank.currentLevel - actualQuantity);
    const percentage = (newLevel / tank.capacity) * 100;
    
    // Get thresholds from settings
    const thresholds = await this.stationSettingsService.getStockThresholds(stationId);
    
    // Determine status based on percentage
    let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    if (percentage <= thresholds.criticalStockThreshold) {
      status = 'CRITICAL';
    } else if (percentage <= thresholds.lowStockThreshold) {
      status = 'WARNING';
    }

    const updatedTank = await prisma.tank.update({
      where: { id: tankId },
      data: {
        currentLevel: newLevel,
        percentage: percentage,
        status: status,
        lastUpdated: new Date(),
      },
    });

    // Log inventory change
    await prisma.inventoryLog.create({
      data: {
        stationId,
        tankId: tank.id,
        productType: tank.productType,
        previousLevel: tank.currentLevel,
        newLevel: newLevel,
        adjustment: -actualQuantity,
        reason: `Sale deduction - ${actualQuantity}L`,
        userId: userId,
      },
    });

    await this.invalidateCache(stationId, tankId);
    return updatedTank;
  }

  async getInventoryLogs(stationId: string, startDate?: Date, endDate?: Date) {
    const logs = await prisma.inventoryLog.findMany({
      where: {
        stationId,
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }

  async getProductMovement(stationId: string, productType?: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await prisma.inventoryLog.findMany({
      where: {
        stationId,
        ...(productType && { productType }),
        createdAt: { gte: startDate },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        tank: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalInflow: movements.filter(m => m.adjustment > 0).reduce((sum, m) => sum + m.adjustment, 0),
      totalOutflow: movements.filter(m => m.adjustment < 0).reduce((sum, m) => sum + Math.abs(m.adjustment), 0),
      netChange: movements.reduce((sum, m) => sum + m.adjustment, 0),
    };

    return { movements, summary };
  }

  async getInventoryAudit(stationId: string) {
    const tanks = await prisma.tank.findMany({
      where: { stationId },
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

    const totalValue = tanks.reduce((sum, tank) => sum + (tank.currentLevel * 225), 0);
    const variances = tanks.filter(tank => tank.percentage < 30);

    return {
      tanks,
      summary: {
        totalItems: tanks.length,
        totalValue,
        variances: variances.length,
        accuracyRate: tanks.length > 0 ? ((tanks.length - variances.length) / tanks.length) * 100 : 100,
        lastAudit: new Date(),
      },
      lowStock: variances,
    };
  }

  async performAudit(stationId: string, data: any) {
    const { productType, expectedLevel, actualLevel, notes } = data;

    const tank = await prisma.tank.findFirst({
      where: {
        stationId,
        productType,
      },
    });

    if (!tank) {
      throw new AppError('Tank not found for this product type', 404);
    }

    const updatedTank = await this.updateTankLevel(tank.id, {
      currentLevel: actualLevel,
      percentage: (actualLevel / tank.capacity) * 100,
    });

    await prisma.inventoryLog.create({
      data: {
        stationId,
        tankId: tank.id,
        productType,
        previousLevel: expectedLevel,
        newLevel: actualLevel,
        adjustment: actualLevel - expectedLevel,
        reason: `Audit: ${notes || 'Physical count'}`,
        userId: 'system',
      },
    });

    return updatedTank;
  }

  async getLowStockAlerts(stationId?: string) {
    const where = stationId ? { stationId } : {};
    
    const tanks = await prisma.tank.findMany({
      where: {
        ...where,
        percentage: { lt: 30 },
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
    });

    return tanks;
  }

  async getProductPrices(stationId?: string) {
    const defaultPrices = [
      { productType: 'PMS', productName: 'Premium Motor Spirit', unitPrice: 650 },
      { productType: 'AGO', productName: 'Automotive Gas Oil', unitPrice: 1200 },
      { productType: 'DPK', productName: 'Dual Purpose Kerosene', unitPrice: 950 },
    ];

    try {
      const prices = await prisma.productPrice.findMany({
        where: stationId
          ? { OR: [{ stationId }, { stationId: null }] }
          : { stationId: null },
      });

      return defaultPrices.map((dp) => {
        const stationPrice = stationId ? prices.find((p) => p.stationId === stationId && p.productType === dp.productType) : null;
        const globalPrice = prices.find((p) => p.stationId === null && p.productType === dp.productType);
        const found = stationPrice || globalPrice;
        return found
          ? { ...dp, id: found.id, productName: found.productName, unitPrice: found.unitPrice, stationId: found.stationId }
          : dp;
      });
    } catch (err) {
      logger.error('Error fetching product prices from DB, returning defaults:', err);
      return defaultPrices;
    }
  }

  async updateProductPrice(data: { stationId?: string; productType: string; productName: string; unitPrice: number; userId: string }) {
    const { stationId, productType, productName, unitPrice, userId } = data;
    const targetStationId = stationId || null;

    const existing = await prisma.productPrice.findFirst({
      where: {
        stationId: targetStationId,
        productType,
      },
    });

    let price;
    if (existing) {
      price = await prisma.productPrice.update({
        where: { id: existing.id },
        data: {
          productName,
          unitPrice,
          updatedById: userId,
        },
      });
    } else {
      price = await prisma.productPrice.create({
        data: {
          stationId: targetStationId,
          productType,
          productName,
          unitPrice,
          updatedById: userId,
        },
      });
    }

    await this.invalidateCache(targetStationId || undefined);
    return price;
  }

  private async invalidateCache(stationId?: string, tankId?: string) {
    if (tankId) {
      await redis.del(`inventory:tank:${tankId}`);
    }
    if (stationId) {
      await redis.del(`inventory:tanks:${stationId}`);
      await redis.del(`inventory:audit:${stationId}`);
    }
    const keys = await redis.keys('inventory:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}