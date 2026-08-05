import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';

export class PumpsService {
  private readonly cacheTTL = 300;
  async getAllPumps() {
    const cacheKey = 'pumps:all';
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const pumps = await prisma.pump.findMany({
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { stationId: 'asc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(pumps));
    return pumps;
  }

  async getStationPumps(stationId: string) {
    if (!stationId) {
      throw new AppError('stationId is required', 400);
    }

    const cacheKey = `pumps:station:${stationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Verify station exists
    const station = await prisma.station.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      throw new AppError('Station not found', 404);
    }

    const pumps = await prisma.pump.findMany({
      where: { stationId },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { pumpNumber: 'asc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(pumps));
    return pumps;
  }

  async getPumpById(id: string) {
    const pump = await prisma.pump.findUnique({
      where: { id },
      include: {
        station: true,
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 10,
        },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!pump) {
      throw new AppError('Pump not found', 404);
    }

    return pump;
  }

  async createPump(data: any) {
    // Validate stationId
    if (!data.stationId) {
      throw new AppError('stationId is required to create a pump', 400);
    }

    // Verify station exists
    const station = await prisma.station.findUnique({
      where: { id: data.stationId },
    });

    if (!station) {
      throw new AppError('Station not found', 404);
    }

    // Check if pump already exists at this station
    const existingPump = await prisma.pump.findFirst({
      where: {
        stationId: data.stationId,
        pumpNumber: data.pumpNumber,
      },
    });

    if (existingPump) {
      throw new AppError(`Pump #${data.pumpNumber} already exists at this station`, 409);
    }

    const pumpData: any = {
      stationId: data.stationId,
      pumpNumber: data.pumpNumber,
      productType: data.productType,
      openingMeter: data.openingMeter || 0,
      closingMeter: data.closingMeter || 0,
      isActive: true,
    };

    if (data.tankId) {
      const tank = await prisma.tank.findUnique({ where: { id: data.tankId } });
      if (!tank) {
        throw new AppError('Tank not found', 404);
      }
      if (tank.stationId !== data.stationId) {
        throw new AppError('Tank must belong to the same station as the pump', 400);
      }
      pumpData.tankId = data.tankId;
    }

    const pump = await prisma.pump.create({
      data: pumpData,
    });

    await this.invalidateCache(data.stationId);
    return pump;
  }

  async updatePump(id: string, data: any) {
    // Check if pump exists
    const existingPump = await prisma.pump.findUnique({
      where: { id },
    });

    if (!existingPump) {
      throw new AppError('Pump not found', 404);
    }

    // If pump number is being changed, check for conflicts
    if (data.pumpNumber && data.pumpNumber !== existingPump.pumpNumber) {
      const conflict = await prisma.pump.findFirst({
        where: {
          stationId: existingPump.stationId,
          pumpNumber: data.pumpNumber,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new AppError(`Pump #${data.pumpNumber} already exists at this station`, 409);
      }
    }

    const updateData: any = {
      pumpNumber: data.pumpNumber,
      productType: data.productType,
      openingMeter: data.openingMeter,
      closingMeter: data.closingMeter,
      isActive: data.isActive,
    };

    if (data.tankId !== undefined) {
      if (data.tankId === null || data.tankId === '') {
        updateData.tankId = null;
      } else {
        const tank = await prisma.tank.findUnique({ where: { id: data.tankId } });
        if (!tank) {
          throw new AppError('Tank not found', 404);
        }
        if (tank.stationId !== existingPump.stationId) {
          throw new AppError('Tank must belong to the same station as the pump', 400);
        }
        updateData.tankId = data.tankId;
      }
    }

    const pump = await prisma.pump.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateCache(pump.stationId, id);
    return pump;
  }

  async recordPumpReading(data: any) {
    const { pumpId, attendantId, stationId, openingMeter, closingMeter } = data;
    
    // Validate meters
    if (closingMeter < openingMeter) {
      throw new AppError('Closing meter cannot be less than opening meter', 400);
    }

    const litresSold = closingMeter - openingMeter;
    
    // Get pump details
    const pump = await prisma.pump.findUnique({
      where: { id: pumpId },
    });

    if (!pump) {
      throw new AppError('Pump not found', 404);
    }

    // Calculate expected revenue (get price from product settings or use default)
    const unitPrice = 225; // Default price, should come from settings
    const expectedRevenue = litresSold * unitPrice;

    const reading = await prisma.pumpReading.create({
      data: {
        pumpId,
        attendantId,
        stationId,
        openingMeter,
        closingMeter,
        litresSold,
        expectedRevenue,
      },
    });

    // Update pump meters
    await prisma.pump.update({
      where: { id: pumpId },
      data: {
        openingMeter: closingMeter,
      },
    });

    await this.invalidateCache(stationId);
    return reading;
  }

  async getPumpReadings(pumpId: string, startDate: Date, endDate: Date) {
    const readings = await prisma.pumpReading.findMany({
      where: {
        pumpId,
        readingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attendant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { readingDate: 'desc' },
    });

    return readings;
  }

  async getPumpDashboard(stationId: string) {
    const pumps = await prisma.pump.findMany({
      where: { stationId },
      include: {
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
        },
        sales: {
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
      },
    });

    const todayVolume = pumps.reduce((sum, p) => {
      const volume = p.sales.reduce((s, sale) => s + sale.quantity, 0);
      return sum + volume;
    }, 0);

    return {
      stationId,
      totalPumps: pumps.length,
      activePumps: pumps.filter(p => p.isActive).length,
      inactivePumps: pumps.filter(p => !p.isActive).length,
      todayVolume,
      pumps: pumps.map(p => ({
        id: p.id,
        pumpNumber: p.pumpNumber,
        productType: p.productType,
        isActive: p.isActive,
        todayVolume: p.sales.reduce((s, sale) => s + sale.quantity, 0),
        todayRevenue: p.sales.reduce((s, sale) => s + sale.totalAmount, 0),
        lastReading: p.readings[0] || null,
      })),
    };
  }

  private async invalidateCache(stationId?: string, pumpId?: string) {
    if (pumpId) {
      await redis.del(`pump:${pumpId}`);
    }
    if (stationId) {
      await redis.del(`pumps:station:${stationId}`);
    }
    const keys = await redis.keys('pumps:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async deletePump(id: string) {
    // Check if pump exists
    const pump = await prisma.pump.findUnique({
      where: { id },
      include: {
        sales: {
          select: { id: true },
        },
        readings: {
          select: { id: true },
        },
      },
    });

    if (!pump) {
      throw new AppError('Pump not found', 404);
    }

    // Check if pump has associated sales or readings
    if (pump.sales.length > 0) {
      throw new AppError(
        'Cannot delete pump with existing sales records. Please archive it instead.',
        400
      );
    }

    if (pump.readings.length > 0) {
      throw new AppError(
        'Cannot delete pump with existing readings. Please archive it instead.',
        400
      );
    }

    // Delete the pump
    await prisma.pump.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache(pump.stationId, id);
  }
}