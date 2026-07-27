import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';

export class LogisticsService {
  private readonly cacheTTL = 300;

  async getAllDeliveries(filters?: {
    status?: string;
    stationId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const cacheKey = `logistics:deliveries:${JSON.stringify(filters)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.stationId && { stationId: filters.stationId }),
        ...(filters?.startDate && {
          dispatchedAt: { gte: filters.startDate },
        }),
        ...(filters?.endDate && {
          dispatchedAt: { lte: filters.endDate },
        }),
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            supplierName: true,
            productType: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
        locationLogs: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
      orderBy: { dispatchedAt: 'desc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(deliveries));
    return deliveries;
  }

  async getDeliveryById(id: string) {
    const cacheKey = `logistics:delivery:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
          },
        },
        locationLogs: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!delivery) {
      throw new AppError('Delivery not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(delivery));
    return delivery;
  }

  async createDelivery(data: any) {
    const delivery = await prisma.delivery.create({
      data: {
        purchaseOrderId: data.purchaseOrderId,
        stationId: data.stationId,
        tankerId: data.tankerId,
        volume: data.volume,
        dispatchedAt: data.dispatchedAt || new Date(),
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        notes: data.notes,
        status: 'IN_TRANSIT',
      },
    });

    // Update purchase order status
    await prisma.purchaseOrder.update({
      where: { id: data.purchaseOrderId },
      data: { status: 'IN_TRANSIT' },
    });

    await this.invalidateCache();
    return delivery;
  }

  async updateDeliveryStatus(id: string, status: string, data?: any) {
    const delivery = await prisma.delivery.update({
      where: { id },
      data: {
        status,
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
        ...(data?.currentLocation && { currentLocation: data.currentLocation }),
      },
    });

    // If delivered, update purchase order status
    if (status === 'DELIVERED') {
      await prisma.purchaseOrder.update({
        where: { id: delivery.purchaseOrderId },
        data: { status: 'DELIVERED', actualDelivery: new Date() },
      });
    }

    await this.invalidateCache(id);
    return delivery;
  }

  async trackDelivery(id: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        locationLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        station: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new AppError('Delivery not found', 404);
    }

    // Calculate estimated time of arrival based on distance
    // This would use a mapping service in production

    return {
      ...delivery,
      eta: this.calculateETA(delivery),
    };
  }

  async addLocationLog(data: any) {
    const log = await prisma.deliveryLocationLog.create({
      data: {
        deliveryId: data.deliveryId,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
      },
    });

    // Update delivery current location
    await prisma.delivery.update({
      where: { id: data.deliveryId },
      data: {
        currentLocation: `${data.latitude},${data.longitude}`,
      },
    });

    return log;
  }

  async getFleetStatus() {
    const deliveries = await prisma.delivery.findMany({
      where: {
        status: { in: ['IN_TRANSIT', 'DELAYED'] },
      },
      include: {
        station: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    return {
      activeDeliveries: deliveries.filter(d => d.status === 'IN_TRANSIT').length,
      delayedDeliveries: deliveries.filter(d => d.status === 'DELAYED').length,
      deliveries,
    };
  }

  private calculateETA(delivery: any): string {
    // Simplified ETA calculation
    // In production, use a mapping service API
    const now = new Date();
    const dispatched = new Date(delivery.dispatchedAt);
    const elapsedHours = (now.getTime() - dispatched.getTime()) / (1000 * 60 * 60);
    
    // Assume average delivery time is 4 hours
    const remainingHours = Math.max(0, 4 - elapsedHours);
    const eta = new Date(now.getTime() + remainingHours * 60 * 60 * 1000);
    
    return eta.toISOString();
  }

  private async invalidateCache(deliveryId?: string) {
    if (deliveryId) {
      await redis.del(`logistics:delivery:${deliveryId}`);
    }
    const keys = await redis.keys('logistics:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}