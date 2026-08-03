import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';

export class StationSettingsService {
  private readonly cacheTTL = 3600; // 1 hour

  async getStationSettings(stationId: string) {
    const cacheKey = `station:settings:${stationId}`;
    
    // Try cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let settings = await prisma.stationSettings.findUnique({
      where: { stationId },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.stationSettings.create({
        data: {
          stationId,
          volumeCorrectionFactor: 0.04,
          lowStockThreshold: 15,
          criticalStockThreshold: 10,
          autoUpdateInventory: true,
        },
      });
      logger.info(`✅ Default settings created for station ${stationId}`);
    }

    // Cache the result
    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(settings));

    return settings;
  }

  async updateStationSettings(stationId: string, data: {
    volumeCorrectionFactor?: number;
    lowStockThreshold?: number;
    criticalStockThreshold?: number;
    autoUpdateInventory?: boolean;
  }) {
    // Validate inputs
    if (data.volumeCorrectionFactor !== undefined) {
      if (data.volumeCorrectionFactor < 0 || data.volumeCorrectionFactor > 0.5) {
        throw new AppError('Volume correction factor must be between 0 and 0.5 (0% to 50%)', 400);
      }
    }

    if (data.lowStockThreshold !== undefined) {
      if (data.lowStockThreshold < 0 || data.lowStockThreshold > 100) {
        throw new AppError('Low stock threshold must be between 0 and 100', 400);
      }
    }

    if (data.criticalStockThreshold !== undefined) {
      if (data.criticalStockThreshold < 0 || data.criticalStockThreshold > 100) {
        throw new AppError('Critical stock threshold must be between 0 and 100', 400);
      }
      // Ensure critical threshold is less than low stock threshold
      const lowThreshold = data.lowStockThreshold !== undefined ? data.lowStockThreshold : 15;
      if (data.criticalStockThreshold >= lowThreshold) {
        throw new AppError('Critical stock threshold must be less than low stock threshold', 400);
      }
    }

    const settings = await prisma.stationSettings.upsert({
      where: { stationId },
      update: {
        volumeCorrectionFactor: data.volumeCorrectionFactor,
        lowStockThreshold: data.lowStockThreshold,
        criticalStockThreshold: data.criticalStockThreshold,
        autoUpdateInventory: data.autoUpdateInventory,
      },
      create: {
        stationId,
        volumeCorrectionFactor: data.volumeCorrectionFactor || 0.04,
        lowStockThreshold: data.lowStockThreshold || 15,
        criticalStockThreshold: data.criticalStockThreshold || 10,
        autoUpdateInventory: data.autoUpdateInventory !== undefined ? data.autoUpdateInventory : true,
      },
    });

    // Invalidate cache
    await this.invalidateCache(stationId);

    logger.info(`✅ Settings updated for station ${stationId}`);
    return settings;
  }

  async getVolumeCorrectionFactor(stationId: string): Promise<number> {
    const settings = await this.getStationSettings(stationId);
    return settings.volumeCorrectionFactor;
  }

  async getStockThresholds(stationId: string): Promise<{ lowStockThreshold: number; criticalStockThreshold: number }> {
    const settings = await this.getStationSettings(stationId);
    return {
      lowStockThreshold: settings.lowStockThreshold,
      criticalStockThreshold: settings.criticalStockThreshold,
    };
  }

  private async invalidateCache(stationId: string) {
    const cacheKey = `station:settings:${stationId}`;
    await redis.del(cacheKey);
  }
}