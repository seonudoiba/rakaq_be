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
        pumps: true,
        inventoryLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
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
        pumps: true,
        inventoryLogs: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });

    if (!tank) {
      throw new AppError('Tank not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(tank));
    return tank;
  }

  async createTank(data: { stationId: string; name: string; productType: string; capacity: number; currentLevel?: number; userId?: string }) {
    const capacity = parseFloat(String(data.capacity));
    const currentLevel = parseFloat(String(data.currentLevel || 0));
    const percentage = Math.min(100, Math.max(0, (currentLevel / capacity) * 100));
    const status = percentage < 20 ? TankStatus.CRITICAL : percentage < 35 ? TankStatus.WARNING : TankStatus.NORMAL;

    const tank = await prisma.tank.create({
      data: {
        stationId: data.stationId,
        name: data.name,
        productType: data.productType,
        capacity,
        currentLevel,
        percentage,
        status,
      },
      include: {
        station: { select: { id: true, name: true, code: true } },
        pumps: true,
      },
    });

    if (currentLevel > 0) {
      await prisma.inventoryLog.create({
        data: {
          stationId: data.stationId,
          tankId: tank.id,
          productType: data.productType,
          previousLevel: 0,
          newLevel: currentLevel,
          adjustment: currentLevel,
          reason: 'Initial tank setup',
          userId: data.userId || 'system',
        },
      });
    }

    await this.invalidateCache(data.stationId);
    return tank;
  }

  async updateTank(id: string, data: { name?: string; productType?: string; capacity?: number; currentLevel?: number; userId?: string }) {
    const existing = await prisma.tank.findUnique({ where: { id } });
    if (!existing) throw new AppError('Tank not found', 404);

    const capacity = data.capacity !== undefined ? parseFloat(String(data.capacity)) : existing.capacity;
    const currentLevel = data.currentLevel !== undefined ? parseFloat(String(data.currentLevel)) : existing.currentLevel;
    const percentage = Math.min(100, Math.max(0, (currentLevel / capacity) * 100));
    const status = percentage < 20 ? TankStatus.CRITICAL : percentage < 35 ? TankStatus.WARNING : TankStatus.NORMAL;

    const tank = await prisma.tank.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        productType: data.productType ?? existing.productType,
        capacity,
        currentLevel,
        percentage,
        status,
        lastUpdated: new Date(),
      },
      include: {
        station: { select: { id: true, name: true, code: true } },
        pumps: true,
        inventoryLogs: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (data.currentLevel !== undefined && data.currentLevel !== existing.currentLevel) {
      await prisma.inventoryLog.create({
        data: {
          stationId: existing.stationId,
          tankId: existing.id,
          productType: tank.productType,
          previousLevel: existing.currentLevel,
          newLevel: currentLevel,
          adjustment: currentLevel - existing.currentLevel,
          reason: 'Tank level update',
          userId: data.userId || 'system',
        },
      });
    }

    await this.invalidateCache(existing.stationId, id);
    return tank;
  }

  async deleteTank(id: string) {
    const existing = await prisma.tank.findUnique({ where: { id } });
    if (!existing) throw new AppError('Tank not found', 404);

    await prisma.pump.updateMany({
      where: { tankId: id },
      data: { tankId: null },
    });

    await prisma.tank.delete({ where: { id } });
    await this.invalidateCache(existing.stationId, id);
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
    
    const thresholds = await this.stationSettingsService.getStockThresholds(stationId);
    
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
    const { tankId, actualLevel, notes } = data;

    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
    });

    if (!tank) {
      throw new AppError('Tank not found', 404);
    }

    const updatedTank = await this.updateTankLevel(tank.id, {
      currentLevel: actualLevel,
      percentage: (actualLevel / tank.capacity) * 100,
    });

    await prisma.inventoryLog.create({
      data: {
        stationId,
        tankId: tank.id,
        productType: tank.productType,
        previousLevel: tank.currentLevel,
        newLevel: actualLevel,
        adjustment: actualLevel - tank.currentLevel,
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

  // FIXED: Get product prices with region support
  async getProductPrices(stationId?: string, regionId?: string) {
    const defaultPrices = [
      { productType: 'PMS', productName: 'Premium Motor Spirit', unitPrice: 850 },
      { productType: 'AGO', productName: 'Automotive Gas Oil', unitPrice: 950 },
      { productType: 'DPK', productName: 'Dual Purpose Kerosene', unitPrice: 500 },
      { productType: 'LPG', productName: 'Liquefied Petroleum Gas', unitPrice: 1200 },
    ];

    try {
      let where: any = {};
      
      if (stationId) {
        where = { OR: [{ stationId }, { stationId: null }] };
      } else if (regionId) {
        // Get all stations in the region
        const stations = await prisma.station.findMany({
          where: { regionId },
          select: { id: true },
        });
        const stationIds = stations.map(s => s.id);
        where = { 
          OR: [
            { stationId: { in: stationIds } },
            { stationId: null }
          ]
        };
      } else {
        where = { stationId: null };
      }

      const prices = await prisma.productPrice.findMany({
        where,
      });

      // Merge default prices with database prices
      return defaultPrices.map((dp) => {
        const found = prices.find((p) => p.productType === dp.productType);
        return found
          ? { 
              id: found.id, 
              productType: found.productType, 
              productName: found.productName, 
              unitPrice: found.unitPrice,
              stationId: found.stationId 
            }
          : dp;
      });
    } catch (err) {
      logger.error('Error fetching product prices from DB, returning defaults:', err);
      return defaultPrices;
    }
  }

  // FIXED: Update product price with scope support
  async updateProductPrice(data: { 
    stationId?: string; 
    regionId?: string;
    productType: string; 
    productName: string; 
    unitPrice: number; 
    userId: string;
    applyToAll?: boolean;
  }) {
    const { stationId, regionId, productType, productName, unitPrice, userId, applyToAll } = data;

    // If applyToAll is true, update all station prices for this product
    if (applyToAll) {
      const stations = await prisma.station.findMany({
        select: { id: true },
      });

      const results = [];
      for (const station of stations) {
        const existing = await prisma.productPrice.findFirst({
          where: {
            stationId: station.id,
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
              stationId: station.id,
              productType,
              productName,
              unitPrice,
              updatedById: userId,
            },
          });
        }
        results.push(price);
      }

      await this.invalidateCache();
      return results;
    }

    // If regionId is provided, update all stations in that region
    if (regionId) {
      const stations = await prisma.station.findMany({
        where: { regionId },
        select: { id: true },
      });

      const results = [];
      for (const station of stations) {
        const existing = await prisma.productPrice.findFirst({
          where: {
            stationId: station.id,
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
              stationId: station.id,
              productType,
              productName,
              unitPrice,
              updatedById: userId,
            },
          });
        }
        results.push(price);
      }

      await this.invalidateCache();
      return results;
    }

    // Single station update
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